import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { cache } from "react";
import { spots, type ResolvedSpot } from "@/lib/config";
import { getCacheStore } from "@/lib/cache";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http/fetch-json";
import { buildSpotForecast, toEngineSpot } from "@/lib/forecast/engine";
import { getProviders } from "@/lib/providers/registry";
import type { ForecastPoint, MarineSeries, TideSeries, WeatherSeries } from "@/lib/providers/types";
import { isFresh, nextRefreshSlot } from "@/lib/schedule";
import { nowSeconds } from "@/lib/time";
import type { ForecastBundle, SpotForecast } from "@/types/forecast";

/**
 * FORECAST SERVICE
 * ================
 * The single entry point for forecast data. Request flow:
 *
 *   1. In-process memo — if this instance already holds a fresh bundle, use it.
 *   2. Shared cache store (file / Upstash) — fresh if generated after the most
 *      recent refresh slot (06:00 / 18:00 UTC by default).
 *   3. Live refresh — fetch all spots in a handful of batched requests, run the
 *      forecast engine and write the result back to the cache.
 *   4. On failure — serve the last good forecast marked "stale", and back off
 *      for REFRESH_FAILURE_BACKOFF_SECONDS so an outage or rate limit upstream
 *      isn't hammered by every page view. Rate limits honour Retry-After.
 *
 * Concurrent callers share one in-flight refresh.
 */

const BUNDLE_VERSION = 1;

interface FailureRecord {
  at: number;
  retryAt: number;
  message: string;
}

const state = globalThis as typeof globalThis & {
  __surfForecast?: { memo: ForecastBundle | null; inflight: Promise<ForecastBundle> | null; failure: FailureRecord | null };
};
const runtime = (state.__surfForecast ??= { memo: null, inflight: null, failure: null });

function bundleKey() {
  return `forecast-bundle-v${BUNDLE_VERSION}-${env.dataSource}`;
}

/** Hash of the spot configuration so edits to config/spots.json invalidate the cache. */
const configHash = (() => {
  const text = JSON.stringify(spots);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
})();

interface StoredBundle {
  configHash: string;
  bundle: ForecastBundle;
}

/** Per-request memoised accessor used by pages, layouts and route handlers. */
export const getForecastBundle = cache(async (): Promise<ForecastBundle> => loadBundle());

export async function getSpotForecast(slug: string): Promise<{ bundle: ForecastBundle; forecast: SpotForecast | null }> {
  const bundle = await getForecastBundle();
  return { bundle, forecast: bundle.spots[slug] ?? null };
}

async function loadBundle(): Promise<ForecastBundle> {
  const now = nowSeconds();
  const memo = runtime.memo;
  if (memo && isFresh(memo.generatedAt, now)) return withStatus(memo, "cached");
  if (runtime.inflight) return runtime.inflight;

  runtime.inflight = (async () => {
    const stored = await readCachedBundle();
    const cached = stored?.bundle ?? null;
    // A config edit makes the cached forecast "not fresh" (forcing a refresh)
    // but it remains usable as a stale fallback.
    if (cached && stored?.configMatches && isFresh(cached.generatedAt, now)) {
      runtime.memo = cached;
      return withStatus(cached, "cached");
    }

    const failure = runtime.failure;
    if (failure && failure.retryAt > now) {
      return cached ? { ...withStatus(cached, "stale"), errors: [failure.message] } : unavailableBundle(failure.message, now);
    }

    try {
      return await refreshForecasts();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryAfter = error instanceof HttpError && error.retryAfter ? error.retryAfter : 0;
      runtime.failure = { at: now, retryAt: now + Math.max(env.failureBackoffSeconds, retryAfter), message };
      console.error(`[forecast] refresh failed: ${message}`);
      return cached ? { ...withStatus(cached, "stale"), errors: [message] } : unavailableBundle(message, now);
    }
  })().finally(() => {
    runtime.inflight = null;
  });

  return runtime.inflight;
}

/**
 * Fetch every spot from the configured providers, build forecasts and persist
 * them. Throws if no marine data could be retrieved at all; partial failures
 * (weather or tide only, or individual spots) are recorded in `errors`.
 */
export async function refreshForecasts(): Promise<ForecastBundle> {
  const providers = getProviders();
  const now = nowSeconds();
  const context = { days: env.forecastDays };
  const points: (ForecastPoint & { stationId?: string })[] = spots.map((spot) => ({
    slug: spot.slug,
    lat: spot.marinePoint.lat,
    lon: spot.marinePoint.lon,
    stationId: spot.tideStationId,
  }));
  const weatherPoints: ForecastPoint[] = spots.map((spot) => ({
    slug: spot.slug,
    lat: spot.location.lat,
    lon: spot.location.lon,
  }));

  const errors: string[] = [];
  const [marineResult, weatherResult] = await Promise.allSettled([
    providers.marine.fetchMarine(points, context),
    providers.weather.fetchWeather(weatherPoints, context),
  ]);
  if (marineResult.status === "rejected") throw marineResult.reason;
  const marine: Record<string, MarineSeries> = marineResult.value;
  if (Object.keys(marine).length === 0) throw new Error("Marine provider returned no data");

  let weather: Record<string, WeatherSeries> = {};
  if (weatherResult.status === "fulfilled") weather = weatherResult.value;
  else errors.push(`Weather data unavailable: ${reason(weatherResult.reason)}`);

  let tides: Record<string, TideSeries> = {};
  try {
    tides = await providers.tide.fetchTides(points, { ...context, marine });
  } catch (error) {
    errors.push(`Tide data unavailable: ${reason(error)}`);
  }

  const forecasts: Record<string, SpotForecast> = {};
  for (const spot of spots) {
    const forecast = buildForSpot(spot, marine[spot.slug], weather[spot.slug] ?? null, tides[spot.slug] ?? null, now);
    if (forecast) forecasts[spot.slug] = forecast;
    else errors.push(`No marine data for ${spot.name}`);
  }

  const sources = [...new Set(Object.values(forecasts).flatMap((forecast) => forecast.sources))];
  const bundle: ForecastBundle = {
    version: BUNDLE_VERSION,
    generatedAt: now,
    status: providers.isSample ? "sample" : "live",
    nextRefreshAt: nextRefreshSlot(now),
    sources,
    errors,
    spots: forecasts,
  };

  runtime.memo = bundle;
  runtime.failure = null;
  await writeCachedBundle(bundle);
  return bundle;
}

function buildForSpot(
  spot: ResolvedSpot,
  marine: MarineSeries | undefined,
  weather: WeatherSeries | null,
  tide: TideSeries | null,
  now: number,
): SpotForecast | null {
  if (!marine || marine.time.length === 0) return null;
  try {
    const forecast = buildSpotForecast(spot.slug, toEngineSpot(spot), { marine, weather, tide }, now);
    return forecast.hasMarineData ? forecast : null;
  } catch (error) {
    console.error(`[forecast] failed to build ${spot.slug}: ${reason(error)}`);
    return null;
  }
}

async function readCachedBundle(): Promise<{ bundle: ForecastBundle; configMatches: boolean } | null> {
  try {
    const raw = await getCacheStore().get(bundleKey());
    if (!raw) return null;
    const stored = JSON.parse(gunzipSync(Buffer.from(raw, "base64")).toString("utf8")) as StoredBundle;
    if (stored.bundle?.version !== BUNDLE_VERSION) return null;
    return { bundle: stored.bundle, configMatches: stored.configHash === configHash };
  } catch (error) {
    console.error(`[forecast] cache read failed: ${reason(error)}`);
    return null;
  }
}

async function writeCachedBundle(bundle: ForecastBundle) {
  try {
    const payload: StoredBundle = { configHash, bundle };
    await getCacheStore().set(bundleKey(), gzipSync(JSON.stringify(payload)).toString("base64"));
  } catch (error) {
    console.error(`[forecast] cache write failed: ${reason(error)}`);
  }
}

function withStatus(bundle: ForecastBundle, status: "cached" | "stale"): ForecastBundle {
  return { ...bundle, status: bundle.status === "sample" ? "sample" : status };
}

function unavailableBundle(message: string, now: number): ForecastBundle {
  return {
    version: BUNDLE_VERSION,
    generatedAt: 0,
    status: "unavailable",
    nextRefreshAt: Math.min(now + env.failureBackoffSeconds, nextRefreshSlot(now)),
    sources: [],
    errors: [message],
    spots: {},
  };
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
