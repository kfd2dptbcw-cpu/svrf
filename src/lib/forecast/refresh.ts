import "server-only";
import { revalidatePath } from "next/cache";
import { getForecastBundle, refreshWithLock } from "./service";
import { isFresh } from "@/lib/schedule";
import { nowSeconds } from "@/lib/time";

/**
 * Scheduled refresh: fetch new data (unless the cache is already fresh for the
 * current slot) and regenerate every statically rendered page.
 */
export async function runScheduledRefresh({ force = false } = {}) {
  const started = Date.now();
  const existing = await getForecastBundle();
  const skip = !force && existing.status !== "stale" && existing.status !== "unavailable" && isFresh(existing.generatedAt, nowSeconds());
  const bundle = skip ? existing : await refreshWithLock();
  revalidatePath("/", "layout");
  return {
    refreshed: !skip,
    status: bundle.status,
    generatedAt: new Date(bundle.generatedAt * 1000).toISOString(),
    nextRefreshAt: new Date(bundle.nextRefreshAt * 1000).toISOString(),
    spots: Object.keys(bundle.spots).length,
    errors: bundle.errors,
    durationMs: Date.now() - started,
  };
}
