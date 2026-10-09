import "server-only";
import { cache } from "react";
import { isFresh, latestRefreshSlot, nextRefreshSlot } from "@/lib/schedule";
import { nowSeconds } from "@/lib/time";
import type { ForecastBundle, SpotForecast } from "@/types/forecast";
import { BUNDLE_VERSION, readCachedBundle } from "./bundle-cache";

/**
 * FORECAST SERVICE (READ-ONLY)
 * ============================
 * The entry point pages, embeds, OG images, route handlers and the build use
 * for forecast data. It ONLY reads the shared cache — it never calls a data
 * provider. Refreshing is done exclusively by `npm run refresh`
 * (lib/forecast/refresh-job.ts), run by GitHub Actions on a schedule.
 *
 *   fresh cache entry  → status "cached"
 *   older cache entry  → status "stale"
 *   nothing cached     → status "unavailable"
 *
 * A request path that could spend API accesses is how a function timeout
 * once turned into an endless retry loop; this design rules it out.
 */

/** Re-read the cache at most this often while it holds nothing fresh. */
const RECHECK_SECONDS = 60;

const state = globalThis as typeof globalThis & {
  __surfForecast?: { memo: ForecastBundle | null; checkedAt: number; inflight: Promise<ForecastBundle> | null };
};
const runtime = (state.__surfForecast ??= { memo: null, checkedAt: 0, inflight: null });

/** Per-request memoised accessor used by pages, layouts and route handlers. */
export const getForecastBundle = cache(async (): Promise<ForecastBundle> => loadBundle());

export async function getSpotForecast(slug: string): Promise<{ bundle: ForecastBundle; forecast: SpotForecast | null }> {
  const bundle = await getForecastBundle();
  return { bundle, forecast: bundle.spots[slug] ?? null };
}

export async function loadBundle(now = nowSeconds()): Promise<ForecastBundle> {
  const memo = runtime.memo;
  // A memo from the current slot needs no re-read until it expires. Anything
  // older (stale, or still fresh but from before today's refresh) is re-read at
  // most once a minute, so a newly written forecast shows up promptly.
  const current = memo?.status === "cached" && memo.generatedAt >= latestRefreshSlot(now) && isFresh(memo.generatedAt, now);
  if (memo && (current || now - runtime.checkedAt < RECHECK_SECONDS)) return memo;
  if (runtime.inflight) return runtime.inflight;

  runtime.inflight = (async () => {
    const stored = await readCachedBundle();
    let bundle: ForecastBundle;
    if (!stored) bundle = unavailableBundle(now);
    else if (stored.configMatches && isFresh(stored.bundle.generatedAt, now)) bundle = withStatus(stored.bundle, "cached");
    else bundle = withStatus(stored.bundle, "stale");
    runtime.memo = bundle;
    runtime.checkedAt = now;
    return bundle;
  })().finally(() => {
    runtime.inflight = null;
  });

  return runtime.inflight;
}

/** Forget the in-process memo (tests). */
export function resetForecastMemo() {
  runtime.memo = null;
  runtime.checkedAt = 0;
  runtime.inflight = null;
}

function withStatus(bundle: ForecastBundle, status: "cached" | "stale"): ForecastBundle {
  return { ...bundle, status: bundle.status === "sample" ? "sample" : status };
}

function unavailableBundle(now: number): ForecastBundle {
  return {
    version: BUNDLE_VERSION,
    generatedAt: 0,
    status: "unavailable",
    nextRefreshAt: nextRefreshSlot(now),
    sources: [],
    errors: ["No forecast has been cached yet"],
    spots: {},
  };
}
