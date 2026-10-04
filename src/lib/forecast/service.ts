import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { cache } from "react";
import { spots, type ResolvedSpot } from "@/lib/config";
import { getCacheStore } from "@/lib/cache";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/http/fetch-json";
import { buildSpotForecast, toEngineSpot } from "@/lib/forecast/engine";
import { getProviders } from "@/lib/providers/registry";
import { AllowanceExhaustedError } from "@/lib/providers/allowance";
import { summariseUsage, takeUsage } from "@/lib/providers/usage";
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
 *      A shared lock (file / Upstash) ensures only one process or instance
 *      refreshes at a time; others wait briefly for its result instead of
 *      spending their own API quota (important on metered APIs like Xweather).
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

    // A failure recorded by this process, or shared by another process/instance.
    const failure = runtime.failure?.retryAt && runtime.failure.retryAt > now ? runtime.failure : await readSharedFailure();
    if (failure && failure.retryAt > now) {
      return cached ? { ...withStatus(cached, "stale"), errors: [failure.message] } : unavailableBundle(failure.message, now);
    }

    try {
      return await refreshWithLock(now);
    } catch (error) {
      const failure = failureFrom(error, now);
      const message = failure.message;
      runtime.failure = failure;
      console.error(`[forecast] refresh failed: ${message}`);
      return cached ? { ...withStatus(cached, "stale"), errors: [message] } : unavailableBundle(message, now);
    }
  })().finally(() => {
    runtime.inflight = null;
  });

  return runtime.inflight;
}

const LOCK_TTL_SECONDS = 120;
const PEER_WAIT_MS = 90_000;
const PEER_POLL_MS = 2_000;

/**
 * Refresh under the shared lock. If another process holds it, poll the cache
 * for its result; only refresh ourselves if the peer doesn't deliver in time.
 */
export async function refreshWithLock(now = nowSeconds()): Promise<ForecastBundle> {
  const store = getCacheStore();
  const lockKey = bundleKey();
  const acquired = await store.acquireLock(lockKey, LOCK_TTL_SECONDS).catch(() => true);
  if (!acquired) {
    const deadline = Date.now() + PEER_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, PEER_POLL_MS));
      const stored = await readCachedBundle();
      if (stored?.configMatches && isFresh(stored.bundle.generatedAt, now)) {
        runtime.memo = stored.bundle;
        return withStatus(stored.bundle, "cached");
      }
      // The lock is free again but no fresh forecast appeared: the peer's
      // refresh failed. Don't spend more quota repeating it straight away.
      if (await store.acquireLock(lockKey, 1).catch(() => false)) {
        await store.releaseLock(lockKey).catch(() => undefined);
        const shared = await readSharedFailure();
        throw new Error(shared?.message ?? "Forecast refresh by another instance failed");
      }
    }
  }
  if (acquired) {
    // Double-check under the lock: a peer may have finished (or failed) between
    // our cache check and taking the lock.
    const stored = await readCachedBundle();
    if (stored?.configMatches && isFresh(stored.bundle.generatedAt, now) && stored.bundle.generatedAt >= now - 60) {
      await store.releaseLock(lockKey).catch(() => undefined);
      runtime.memo = stored.bundle;
      return withStatus(stored.bundle, "cached");
    }
    const shared = await readSharedFailure();
    if (shared && shared.retryAt > now && shared.at >= now - 60) {
      await store.releaseLock(lockKey).catch(() => undefined);
      throw new Error(shared.message);
    }
  }

  try {
    const bundle = await refreshForecasts();
    await store.set(failureKey(), "").catch(() => undefined);
    return bundle;
  } catch (error) {
    // A failed refresh may still have been charged for the requests that succeeded.
    const spent = summariseUsage(takeUsage()).totalTokens;
    if (spent > 0) console.warn(`[forecast] failed refresh still used ${spent} API accesses`);
    // Share the failure (before releasing the lock) so peers back off too.
    await store.set(failureKey(), JSON.stringify(failureFrom(error, now))).catch(() => undefined);
    throw error;
  } finally {
    if (acquired) await store.releaseLock(lockKey).catch(() => undefined);
  }
}

function failureKey() {
  return `${bundleKey()}-failure`;
}

function failureFrom(error: unknown, now: number): FailureRecord {
  const message = error instanceof Error ? error.message : String(error);
  // Allowance exhausted: don't try again until the billing period resets.
  if (error instanceof AllowanceExhaustedError) return { at: now, retryAt: Math.max(error.retryAt, now + env.failureBackoffSeconds), message };
  const retryAfter = error instanceof HttpError && error.retryAfter ? error.retryAfter : 0;
  return { at: now, retryAt: now + Math.max(env.failureBackoffSeconds, retryAfter), message };
}

async function readSharedFailure(): Promise<FailureRecord | null> {
  try {
    const raw = await getCacheStore().get(failureKey());
    return raw ? (JSON.parse(raw) as FailureRecord) : null;
  } catch {
    return null;
  }
}

/**
 * Fetch every spot from the configured providers, build forecasts and persist
 * them. Throws if no marine data could be retrieved at all; partial failures
 * (weather or tide only, or individual spots) are recorded in `errors`.
 */
export async function refreshForecasts(): Promise<ForecastBundle> {
  const providers = getProviders();
  const now = nowSeconds();
  takeUsage(); // discard anything left over from an earlier, failed refresh
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
  const bundle: ForecastBundle = {
    version: BUNDLE_VERSION,
    generatedAt: now,
    status: providers.isSample ? "sample" : "live",
    nextRefreshAt: nextRefreshSlot(now),
    sources,
    errors,
    spots: forecasts,
    apiUsage,
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
