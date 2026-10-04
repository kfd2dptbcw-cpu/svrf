import { env } from "@/lib/env";
import { fetchJson, HttpError } from "@/lib/http/fetch-json";
import { sunTimesForRange } from "@/lib/sun";
import { recordCost } from "./usage";
import type { ForecastPoint, MarineProvider, MarineSeries, ProviderContext, Series, WeatherProvider, WeatherSeries } from "./types";

/**
 * Vaisala Xweather (https://www.xweather.com) — free developer tier of 15,000
 * API accesses per month, then paid. Requires XWEATHER_CLIENT_ID and
 * XWEATHER_CLIENT_SECRET.
 *
 *   Marine:  /maritime/{lat},{lon}   waves, swell trains, sea temperature, tides
 *   Weather: /forecasts/{lat},{lon}  hourly wind, gusts, temperature, weather
 *
 * Both endpoints have a ×1 endpoint multiplier, but Xweather may also bill a
 * request once per time interval it covers (its docs don't list which
 * endpoints do), so a multi-day request can cost more than one access. Every
 * response's `X-Cost-Tokens` header is recorded (see usage.ts): each refresh
 * logs its real total, and `npm run provider:check` projects monthly usage.
 * Sunrise/sunset are calculated locally (lib/sun.ts) so they cost nothing.
 *
 * Requests run with limited concurrency, and the whole batch stops at the
 * first authentication or rate-limit error so a bad key or exhausted quota
 * doesn't burn through further accesses.
 */

const CONCURRENCY = 4;
const SOURCE_MARINE = "Vaisala Xweather Maritime";
const SOURCE_WEATHER = "Vaisala Xweather Forecasts";

type Period = Record<string, unknown>;

interface XweatherResponse {
  success: boolean;
  error: { code?: string; description?: string } | null;
  response: { periods?: Period[] } | { periods?: Period[] }[] | null;
}

export class XweatherConfigError extends Error {
  override name = "XweatherConfigError";
}

function credentials() {
  const id = env.xweatherClientId;
  const secret = env.xweatherClientSecret;
  if (!id || !secret) throw new XweatherConfigError("XWEATHER_CLIENT_ID and XWEATHER_CLIENT_SECRET must be set");
  return { id, secret };
}

function buildUrl(endpoint: string, point: ForecastPoint, params: Record<string, string>): string {
  const { id, secret } = credentials();
  const url = new URL(`${env.xweatherApiUrl.replace(/\/$/, "")}/${endpoint}/${point.lat.toFixed(4)},${point.lon.toFixed(4)}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("client_id", id);
  url.searchParams.set("client_secret", secret);
  return url.toString();
}

/** Errors that will repeat for every remaining request in the batch. */
function isFatal(error: unknown): boolean {
  return (
    error instanceof XweatherConfigError ||
    (error instanceof HttpError && (error.status === 401 || error.status === 403 || error.status === 429))
  );
}

/** Extract hourly periods; returns null when Xweather reports no data for the location. */
async function fetchPeriods(url: string, label: string, signal: AbortSignal): Promise<Period[] | null> {
  const endpoint = `/${new URL(url).pathname.split("/").filter(Boolean)[0] ?? ""}`;
  const data = await fetchJson<XweatherResponse>(url, {
    label,
    retries: 1,
    signal,
    onResponse: (headers) => {
      const tokens = Number(headers.get("x-cost-tokens"));
      if (Number.isFinite(tokens) && headers.has("x-cost-tokens")) {
        const remaining = Number(headers.get("x-ratelimit-remaining-period"));
        recordCost({
          provider: "xweather",
          endpoint,
          tokens,
          // The wire header is plural; Xweather's docs also show it singular.
          multipliers: headers.get("x-cost-multipliers") ?? headers.get("x-cost-multiplier"),
          remainingPeriod: headers.has("x-ratelimit-remaining-period") && Number.isFinite(remaining) ? remaining : null,
        });
      }
    },
  });
  if (!data.success) {
    const code = data.error?.code ?? "unknown_error";
    if (code === "warn_no_data" || code === "invalid_location") return null;
    // Xweather reports auth and quota problems in the body with HTTP 200.
    const status = /auth|client|unauthorized/i.test(code) ? 401 : /limit|exceed|maxhits/i.test(code) ? 429 : null;
    throw new HttpError(`${label}: ${code}${data.error?.description ? ` — ${data.error.description}` : ""}`, status);
  }
  const response = Array.isArray(data.response) ? data.response[0] : data.response;
  const periods = response?.periods ?? [];
  return periods.length > 0 ? periods : null;
}

/**
 * Run `task` for every point with bounded concurrency. Per-spot failures are
 * skipped; fatal errors (auth, quota) abort the batch and are rethrown.
 */
async function forEachPoint<T>(
  points: ForecastPoint[],
  context: ProviderContext,
  task: (point: ForecastPoint, signal: AbortSignal) => Promise<T | null>,
): Promise<Record<string, T>> {
  const controller = new AbortController();
  const onAbort = () => controller.abort(context.signal?.reason);
  context.signal?.addEventListener("abort", onAbort);
  const results: Record<string, T> = {};
  let fatal: unknown = null;
  let firstError: unknown = null;
  let next = 0;

  const worker = async () => {
    while (next < points.length && !fatal) {
      const point = points[next++]!;
      try {
        const value = await task(point, controller.signal);
        if (value !== null) results[point.slug] = value;
      } catch (error) {
        if (isFatal(error)) {
          fatal ??= error;
          controller.abort();
        } else {
          firstError ??= error;
        }
      }
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, points.length) }, worker));
  } finally {
    context.signal?.removeEventListener("abort", onAbort);
  }
  if (fatal) throw fatal;
  if (Object.keys(results).length === 0 && firstError) throw firstError;
  return results;
}

function num(period: Period, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = period[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function series(periods: Period[], ...keys: string[]): Series {
  return periods.map((period) => num(period, ...keys));
}

/** Keep only top-of-hour periods, sorted, de-duplicated. */
function hourlyPeriods(periods: Period[]): { periods: Period[]; time: number[] } {
  const byTime = new Map<number, Period>();
  for (const period of periods) {
    const timestamp = num(period, "timestamp");
    if (timestamp !== null && timestamp % 3600 === 0) byTime.set(timestamp, period);
  }
  const time = [...byTime.keys()].sort((a, b) => a - b);
  return { periods: time.map((t) => byTime.get(t)!), time };
}

export class XweatherMarineProvider implements MarineProvider {
  readonly id = "xweather-marine";

  async fetchMarine(points: ForecastPoint[], context: ProviderContext): Promise<Record<string, MarineSeries>> {
    return forEachPoint(points, context, async (point, signal) => {
      const raw = await fetchPeriods(
        buildUrl("maritime", point, {
          filter: "1hr",
          // Start at local midnight so today's early hours are included (the endpoint keeps 48h of history).
          from: "today",
          to: `+${context.days}days`,
          // /maritime takes plimit (periods), not limit.
          plimit: String(context.days * 24 + 24),
        }),
        SOURCE_MARINE,
        signal,
      );
      if (!raw) return null;
      const { periods, time } = hourlyPeriods(raw);
      return {
        time,
        waveHeight: series(periods, "significantWaveHeightM"),
        waveDirection: series(periods, "primaryWaveDirDEG"),
        wavePeriod: series(periods, "primaryWavePeriod"),
        swellHeight: series(periods, "swellHeightM", "swell1HeightM"),
        swellDirection: series(periods, "swellDirDEG", "swell1DirDEG"),
        swellPeriod: series(periods, "swellPeriod", "swell1Period"),
        secondarySwellHeight: series(periods, "swell2HeightM"),
        secondarySwellDirection: series(periods, "swell2DirDEG"),
        secondarySwellPeriod: series(periods, "swell2Period"),
        windWaveHeight: series(periods, "windWaveHeightM"),
        seaSurfaceTemperature: series(periods, "seaSurfaceTemperatureC"),
        seaLevel: series(periods, "tidesM"),
        source: SOURCE_MARINE,
      };
    });
  }
}

export class XweatherWeatherProvider implements WeatherProvider {
  readonly id = "xweather-weather";

  async fetchWeather(points: ForecastPoint[], context: ProviderContext): Promise<Record<string, WeatherSeries>> {
    return forEachPoint(points, context, async (point, signal) => {
      const raw = await fetchPeriods(
        buildUrl("forecasts", point, { filter: "1hr", limit: String(context.days * 24) }),
        SOURCE_WEATHER,
        signal,
      );
      if (!raw) return null;
      const { periods, time } = hourlyPeriods(raw);
      return {
        time,
        temperature: series(periods, "tempC"),
        windSpeed: series(periods, "windSpeedKPH"),
        windGusts: series(periods, "windGustKPH"),
        windDirection: series(periods, "windDirDEG"),
        weatherCode: periods.map((period) => xweatherCodeToWmo(period.weatherPrimaryCoded)),
        daily: sunTimesForRange(time, point.lat, point.lon),
        source: SOURCE_WEATHER,
      };
    });
  }
}

/**
 * Convert an Xweather coded weather string ("coverage:intensity:weather",
 * e.g. ":L:RW" or "::OV") into the WMO weather code the UI icons understand.
 */
export function xweatherCodeToWmo(coded: unknown): number | null {
  if (typeof coded !== "string" || coded.length === 0) return null;
  const weather = coded.split(":").pop()?.toUpperCase() ?? "";
  const precipitation: Record<string, number> = {
    T: 95,
    A: 96,
    S: 71,
    SW: 85,
    SI: 77,
    BS: 75,
    IC: 77,
    RS: 67,
    WM: 67,
    IP: 67,
    ZR: 66,
    ZL: 56,
    R: 61,
    RW: 80,
    L: 51,
    UP: 61,
    F: 45,
    ZF: 48,
    IF: 48,
    BR: 45,
    H: 45,
    K: 45,
  };
  const sky: Record<string, number> = { CL: 0, FW: 1, SC: 2, BK: 3, OV: 3 };
  return precipitation[weather] ?? sky[weather] ?? null;
}
