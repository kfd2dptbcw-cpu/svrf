/**
 * Records the API usage that metered providers report per request (Xweather
 * returns the exact charge in `X-Cost-Tokens`), so each refresh can log what
 * it really cost and `npm run provider:check` can project monthly usage.
 */

export interface RequestCost {
  provider: string;
  endpoint: string;
  /** Accesses charged for the request, from the provider's own header. */
  tokens: number;
  /** Raw multiplier breakdown, e.g. "endpoint=1; spatial=1; temporal=8". */
  multipliers: string | null;
  /** Accesses left in the current billing period, if the provider reports it. */
  remainingPeriod: number | null;
}

const state = globalThis as typeof globalThis & { __surfUsage?: RequestCost[] };

export function recordCost(cost: RequestCost) {
  (state.__surfUsage ??= []).push(cost);
}

/** Return everything recorded since the last call and reset the log. */
export function takeUsage(): RequestCost[] {
  const usage = state.__surfUsage ?? [];
  state.__surfUsage = [];
  return usage;
}

export function summariseUsage(usage: readonly RequestCost[]) {
  const byEndpoint = new Map<string, { requests: number; tokens: number; multipliers: Set<string> }>();
  for (const cost of usage) {
    const key = `${cost.provider} ${cost.endpoint}`;
    const entry = byEndpoint.get(key) ?? { requests: 0, tokens: 0, multipliers: new Set<string>() };
    entry.requests += 1;
    entry.tokens += cost.tokens;
    if (cost.multipliers) entry.multipliers.add(cost.multipliers);
    byEndpoint.set(key, entry);
  }
  const remaining = usage.map((cost) => cost.remainingPeriod).filter((value): value is number => value !== null);
  return {
    totalTokens: usage.reduce((sum, cost) => sum + cost.tokens, 0),
    remainingPeriod: remaining.length > 0 ? Math.min(...remaining) : null,
    endpoints: [...byEndpoint.entries()].map(([name, entry]) => ({
      name,
      requests: entry.requests,
      tokens: entry.tokens,
      multipliers: [...entry.multipliers],
    })),
  };
}
