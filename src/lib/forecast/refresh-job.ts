import { spots, type ResolvedSpot } from "@/lib/config";
import { getCacheStore } from "@/lib/cache";
import { env } from "@/lib/env";
import { buildSpotForecast, toEngineSpot } from "@/lib/forecast/engine";
import { getProviders } from "@/lib/providers/registry";
import { summariseUsage, takeUsage } from "@/lib/providers/usage";
import type { ForecastPoint, MarineSeries, TideSeries, WeatherSeries } from "@/lib/providers/types";
import { nextRefreshSlot } from "@/lib/schedule";
import { nowSeconds } from "@/lib/time";
import type { ForecastBundle, SpotForecast } from "@/types/forecast";
import { BUNDLE_VERSION, bundleKey, writeCachedBundle } from "./bundle-cache";
import { claimRefreshAttempt, recordRefreshUsage, type RefreshAttempt } from "./refresh-guard";

/**
 * THE ONLY CODE PATH THAT CALLS THE DATA PROVIDERS.
 * Run by `npm run refresh` (GitHub Actions, 06:05 and 18:05 UTC) — never by
 * pages, route handlers or the build, which only read the cache.
 *
 *   1. Take the shared lock (one refresh at a time).
 *   2. Claim the attempt: write `last-refresh-attempt`, refusing to start if the
 *      previous attempt was under 3 hours ago (unless forced).
 *   3. Fetch, build, write the bundle to the cache.
 *   4. Record the accesses charged — on success and failure alike.
 */

const LOCK_TTL_SECONDS = 30 * 60;

const state = globalThis as typeof globalThis & { __surfActiveAttempt?: RefreshAttempt | null };

export interface RefreshResult {
  attempt: RefreshAttempt;
  bundle: ForecastBundle;
  accesses: number;
  accessesLast24h: number;
}

export async function runRefresh({ force = false } = {}): Promise<RefreshResult> {
  const store = getCacheStore();
  const lockKey = bundleKey();
  if (!(await store.acquireLock(lockKey, LOCK_TTL_SECONDS))) {
    throw new Error("Another refresh holds the lock; not starting a second one");
  }
  try {
    const attempt = await claimRefreshAttempt({ force, store });
    state.__surfActiveAttempt = attempt;
    takeUsage(); // discard anything left over from earlier work in this process

    let bundle: ForecastBundle | undefined;
    try {
      bundle = await refreshForecasts(attempt.at);
      await writeCachedBundle(bundle);
    } catch (error) {
      // Usage already folded into a built bundle still counts if saving it failed.
      await recordAttemptUsage(attempt, reason(error), bundle?.apiUsage?.totalTokens ?? 0);
      throw error;
    }
    const accesses = bundle.apiUsage?.totalTokens ?? 0;
    const accessesLast24h = await recordRefreshUsage({ at: attempt.at, accesses, ok: true }, { store });
    state.__surfActiveAttempt = null;
    return { attempt, bundle, accesses, accessesLast24h };
  } finally {
    await store.releaseLock(lockKey).catch(() => undefined);
  }
}

/**
 * Record whatever the in-flight attempt has been charged so far. Used on
 * failure and by the CLI's signal handler if the process is being killed.
 */
export async function recordAttemptUsage(attempt = state.__surfActiveAttempt, error = "interrupted", alreadyCounted = 0) {
  if (!attempt) return;
  state.__surfActiveAttempt = null;
  const accesses = alreadyCounted + summariseUsage(takeUsage()).totalTokens;
  if (accesses > 0) console.warn(`[forecast] failed refresh still used ${accesses} API accesses`);
  await recordRefreshUsage({ at: attempt.at, accesses, ok: false, error }).catch((err: unknown) =>
    console.error(`[forecast] could not record refresh usage: ${err instanceof Error ? err.message : String(err)}`),
  );
}

/**
 * Fetch every spot from the configured providers and build forecasts. Throws
 * if no marine data could be retrieved at all; partial failures (weather or
 * tide only, or individual spots) are recorded in `errors`.
 */
export async function refreshForecasts(now = nowSeconds()): Promise<ForecastBundle> {
  const providers = getProviders();
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
  // Marine data is required, so fetch it first: if it fails, no weather
  // requests are spent (metered APIs count every call).
  const marine: Record<string, MarineSeries> = await providers.marine.fetchMarine(points, context);
  if (Object.keys(marine).length === 0) throw new Error("Marine provider returned no data");
  const [weatherResult] = await Promise.allSettled([
    providers.weather.fetchWeather(weatherPoints.filter((point) => marine[point.slug] !== undefined), context),
  ]);

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
  const usage = takeUsage();
  const apiUsage = usage.length > 0 ? summariseUsage(usage) : undefined;
  if (apiUsage) {
    const detail = apiUsage.endpoints.map((endpoint) => `${endpoint.name}: ${endpoint.tokens} over ${endpoint.requests} requests`).join("; ");
    console.info(
      `[forecast] refresh used ${apiUsage.totalTokens} API accesses (${detail})` +
        (apiUsage.remainingPeriod !== null ? `; ${apiUsage.remainingPeriod} left this period` : ""),
    );
  }
  return {
    version: BUNDLE_VERSION,
    generatedAt: now,
    status: providers.isSample ? "sample" : "live",
    nextRefreshAt: nextRefreshSlot(now),
    sources,
    errors,
    spots: forecasts,
    apiUsage,
  };
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

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
