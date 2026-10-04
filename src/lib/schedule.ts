import { env } from "@/lib/env";

/**
 * Refresh schedule. Forecast models update a few times a day, so we refresh at
 * fixed UTC "slots" (default 06:00 and 18:00). A cached forecast is fresh if
 * it was generated after the most recent slot; this caps upstream traffic at
 * one refresh per slot no matter how much traffic the site receives.
 */

export function latestRefreshSlot(nowSeconds: number, hours = env.refreshHoursUtc): number {
  const now = new Date(nowSeconds * 1000);
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000;
  const today = hours.map((hour) => midnight + hour * 3600).filter((slot) => slot <= nowSeconds);
  if (today.length > 0) return Math.max(...today);
  return midnight - 86400 + Math.max(...hours) * 3600;
}

export function nextRefreshSlot(nowSeconds: number, hours = env.refreshHoursUtc): number {
  const now = new Date(nowSeconds * 1000);
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000;
  const upcoming = hours.map((hour) => midnight + hour * 3600).filter((slot) => slot > nowSeconds);
  if (upcoming.length > 0) return Math.min(...upcoming);
  return midnight + 86400 + Math.min(...hours) * 3600;
}

/** Maximum age of a cached forecast, regardless of slots (12 hours). */
export const MAX_CACHE_AGE_SECONDS = 12 * 3600;

export function isFresh(generatedAt: number, nowSeconds: number): boolean {
  return generatedAt >= latestRefreshSlot(nowSeconds) && nowSeconds - generatedAt < MAX_CACHE_AGE_SECONDS;
}
