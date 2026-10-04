import { getCacheStore } from "@/lib/cache";
import { env } from "@/lib/env";
import { nowSeconds } from "@/lib/time";

/**
 * HARD MONTHLY CAP FOR METERED PROVIDERS (Xweather)
 * -------------------------------------------------
 * Every Xweather response reports the accesses left in the billing period
 * (`X-RateLimit-Remaining-Period`) and when the period resets
 * (`X-RateLimit-Reset-Period`). We keep the latest reading, in memory and in
 * the shared cache store so every instance sees it, and:
 *
 *   remaining < XWEATHER_WARN_REMAINING (3,000)  → log a warning on each refresh
 *   remaining < XWEATHER_MIN_REMAINING  (1,000)  → skip Xweather refreshes until
 *                                                 the period resets; the site keeps
 *                                                 serving the cached forecast
 *
 * The floor is also enforced mid-refresh: once a response reports the
 * allowance below the floor, the remaining requests in that batch are not sent.
 */

export interface AllowanceState {
  provider: string;
  remaining: number;
  /** Unix seconds when the billing period resets, if the provider said. */
  resetAt: number | null;
  observedAt: number;
}

export class AllowanceExhaustedError extends Error {
  override name = "AllowanceExhaustedError";
  constructor(
    message: string,
    /** Unix seconds after which refreshing may be attempted again. */
    readonly retryAt: number,
  ) {
    super(message);
  }
}

const KEY = "provider-allowance-v1";
const state = globalThis as typeof globalThis & { __surfAllowance?: Record<string, AllowanceState> };
const memory = (state.__surfAllowance ??= {});

/** Start of the next calendar month (UTC) — the assumed reset when the provider doesn't say. */
export function nextMonthStart(unixSeconds: number): number {
  const date = new Date(unixSeconds * 1000);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000;
}

/** Parse a reset header given as unix seconds, unix milliseconds or a date string. */
export function parseResetHeader(value: string | null): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric > 1e12 ? numeric / 1000 : numeric);
  const parsed = Date.parse(value.includes("T") || /gmt|utc|z$/i.test(value) ? value : `${value} GMT`);
  return Number.isNaN(parsed) ? null : Math.round(parsed / 1000);
}

/** Record a reading from response headers (synchronous; persisted by persistAllowance). */
export function noteAllowance(provider: string, remaining: number, resetAt: number | null, now = nowSeconds()) {
  const previous = memory[provider];
  // Within the same period readings only go down; concurrent responses can arrive out of order.
  const samePeriod = previous && (previous.resetAt ?? 0) === (resetAt ?? 0);
  memory[provider] = {
    provider,
    remaining: samePeriod ? Math.min(previous.remaining, remaining) : remaining,
    resetAt,
    observedAt: now,
  };
}

export async function persistAllowance(provider: string) {
  const current = memory[provider];
  if (!current) return;
  await getCacheStore()
    .set(`${KEY}-${provider}`, JSON.stringify(current))
    .catch(() => undefined);
}

/** Latest reading from this process or, failing that, the shared cache. */
export async function loadAllowance(provider: string): Promise<AllowanceState | null> {
  const local = memory[provider];
  let shared: AllowanceState | null = null;
  try {
    const raw = await getCacheStore().get(`${KEY}-${provider}`);
    shared = raw ? (JSON.parse(raw) as AllowanceState) : null;
  } catch {
    shared = null;
  }
  if (!local) return shared;
  if (!shared) return local;
  return shared.observedAt > local.observedAt ? shared : local;
}

function resetTime(allowance: AllowanceState): number {
  return allowance.resetAt ?? nextMonthStart(allowance.observedAt);
}

/** True when the allowance is known to be below the floor and the period hasn't reset yet. */
export function isBelowFloor(allowance: AllowanceState | null | undefined, now = nowSeconds()): boolean {
  return Boolean(allowance && allowance.remaining < env.minRemainingAllowance && resetTime(allowance) > now);
}

/** Synchronous mid-batch check against the latest in-memory reading. */
export function allowanceExhaustedError(provider: string, now = nowSeconds()): AllowanceExhaustedError | null {
  const allowance = memory[provider];
  if (!allowance || !isBelowFloor(allowance, now)) return null;
  return new AllowanceExhaustedError(
    `${provider} allowance down to ${allowance.remaining} accesses (floor ${env.minRemainingAllowance}); ` +
      `skipping refreshes until ${new Date(resetTime(allowance) * 1000).toISOString()} and serving cached forecasts`,
    resetTime(allowance),
  );
}

/**
 * Called before a metered refresh. Throws AllowanceExhaustedError below the
 * floor; logs a warning below the warning threshold.
 */
export async function assertAllowance(provider: string, now = nowSeconds()): Promise<void> {
  const allowance = await loadAllowance(provider);
  if (!allowance) return;
  if (allowance.observedAt > (memory[provider]?.observedAt ?? 0)) memory[provider] = allowance;
  const exhausted = allowanceExhaustedError(provider, now);
  if (exhausted) throw exhausted;
  if (allowance.remaining < env.warnRemainingAllowance && resetTime(allowance) > now) {
    console.warn(
      `[forecast] ${provider} allowance low: ${allowance.remaining} accesses left this period ` +
        `(refreshes stop below ${env.minRemainingAllowance})`,
    );
  }
}
