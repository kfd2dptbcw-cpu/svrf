import { getCacheStore, type CacheStore } from "@/lib/cache";
import { env } from "@/lib/env";
import { nowSeconds } from "@/lib/time";

/**
 * HARD LOOP GUARD AND ACCESS LEDGER
 * =================================
 * Every refresh attempt first writes `last-refresh-attempt` to the shared
 * store, and no attempt starts within MIN_ATTEMPT_INTERVAL_SECONDS of the
 * previous one — whether that one succeeded, failed or was killed half-way.
 * However a refresh dies, the worst case is one attempt every 3 hours.
 *
 * Every attempt also appends the API accesses it was charged (including
 * failed attempts) to `refresh-usage-log`, so /api/health can report the
 * accesses spent in the last 24 hours.
 */

export const LAST_ATTEMPT_KEY = "last-refresh-attempt";
export const USAGE_LOG_KEY = "refresh-usage-log";
export const MIN_ATTEMPT_INTERVAL_SECONDS = 3 * 3600;
const LOG_RETENTION_SECONDS = 7 * 86400;

export interface RefreshAttempt {
  /** Unix seconds when the attempt started. */
  at: number;
  forced: boolean;
}

export interface UsageEntry {
  /** Unix seconds when the attempt started. */
  at: number;
  accesses: number;
  ok: boolean;
  error?: string;
}

export class RefreshTooSoonError extends Error {
  override name = "RefreshTooSoonError";
  constructor(
    readonly lastAttemptAt: number,
    readonly retryAt: number,
  ) {
    super(
      `Last refresh attempt was at ${new Date(lastAttemptAt * 1000).toISOString()}; ` +
        `refusing to start another before ${new Date(retryAt * 1000).toISOString()} (use --force to override)`,
    );
  }
}

export async function readLastAttempt(store: CacheStore = getCacheStore()): Promise<RefreshAttempt | null> {
  const raw = await store.get(LAST_ATTEMPT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RefreshAttempt> | number;
    if (typeof parsed === "number") return { at: parsed, forced: false };
    return typeof parsed.at === "number" ? { at: parsed.at, forced: Boolean(parsed.forced) } : null;
  } catch {
    return null;
  }
}

/**
 * Record a new attempt, or throw RefreshTooSoonError if the previous one was
 * under 3 hours ago (unless forced). Errors reading the store also throw: if
 * the guard can't be checked, no refresh starts.
 */
export async function claimRefreshAttempt({ force = false, now = nowSeconds(), store = getCacheStore() } = {}): Promise<RefreshAttempt> {
  const last = await readLastAttempt(store);
  if (!force && last && now - last.at < MIN_ATTEMPT_INTERVAL_SECONDS) {
    throw new RefreshTooSoonError(last.at, last.at + MIN_ATTEMPT_INTERVAL_SECONDS);
  }
  const attempt: RefreshAttempt = { at: now, forced: force };
  await store.set(LAST_ATTEMPT_KEY, JSON.stringify(attempt));
  return attempt;
}

export async function readUsageLog(store: CacheStore = getCacheStore()): Promise<UsageEntry[]> {
  try {
    const raw = await store.get(USAGE_LOG_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as UsageEntry[]).filter((entry) => typeof entry?.at === "number") : [];
  } catch {
    return [];
  }
}

/** Append an attempt's usage (keeping a week of history) and return the new 24-hour total. */
export async function recordRefreshUsage(entry: UsageEntry, { now = nowSeconds(), store = getCacheStore() } = {}): Promise<number> {
  const log = (await readUsageLog(store)).filter((item) => item.at > now - LOG_RETENTION_SECONDS);
  log.push(entry);
  await store.set(USAGE_LOG_KEY, JSON.stringify(log));
  const total = sumLast24h(log, now);
  warnIfOverDailyBudget(total);
  return total;
}

export function sumLast24h(log: readonly UsageEntry[], now = nowSeconds()): number {
  return log.filter((entry) => entry.at > now - 86400).reduce((sum, entry) => sum + (entry.accesses || 0), 0);
}

export async function accessesLast24h(now = nowSeconds(), store: CacheStore = getCacheStore()): Promise<number> {
  return sumLast24h(await readUsageLog(store), now);
}

/** Loud warning when more accesses than expected were spent in a day. Returns true if it warned. */
export function warnIfOverDailyBudget(total: number): boolean {
  const limit = env.dailyAccessWarning;
  if (total <= limit) return false;
  const message = `API accesses in the last 24h: ${total} — above the ${limit}/day warning level. Check for runaway refreshes!`;
  console.error(`\n${"!".repeat(80)}\n[forecast] WARNING: ${message}\n${"!".repeat(80)}\n`);
  // Surfaces as an annotation on the GitHub Actions run.
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Xweather usage::${message}`);
  return true;
}
