import { env } from "@/lib/env";

/**
 * Refresh schedule. The refresh job runs at fixed UTC "slots" (default once a
 * day at 06:00, actually started at 06:05 by GitHub Actions). A cached
 * forecast stays fresh until the next slot's refresh is due, plus a grace
 * period for a late-running job: with one daily slot that is 26 hours.
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

/** Allowance for the scheduled job starting late (GitHub Actions cron can lag) or a slow refresh. */
export const FRESHNESS_GRACE_SECONDS = 2 * 3600;

/** Longest gap between consecutive refresh slots, in seconds (24 hours for a single daily slot). */
export function longestSlotGap(hours = env.refreshHoursUtc): number {
  const sorted = [...hours].sort((a, b) => a - b);
  return Math.max(...sorted.map((hour, i) => ((sorted[(i + 1) % sorted.length]! - hour + 24) % 24 || 24) * 3600));
}

/** How long a forecast counts as fresh: the longest slot gap plus grace (26 h for one daily slot). */
export function maxCacheAgeSeconds(hours = env.refreshHoursUtc): number {
  return longestSlotGap(hours) + FRESHNESS_GRACE_SECONDS;
}

export function isFresh(generatedAt: number, nowSeconds: number, hours = env.refreshHoursUtc): boolean {
  return generatedAt > 0 && nowSeconds - generatedAt < maxCacheAgeSeconds(hours);
}
