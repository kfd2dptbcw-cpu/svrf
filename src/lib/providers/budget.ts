/**
 * Monthly access budgeting for metered providers (Xweather).
 *
 * Xweather charges `endpoint × spatial × temporal` accesses per request. The
 * temporal factor may be 1 (flat), the number of days covered, or the number
 * of periods returned — the docs don't say which applies to /maritime and
 * /forecasts, so we infer it from a real response's X-Cost-Multipliers header
 * and project the monthly total for each option the app supports:
 * hourly or 3-hourly intervals, and fewer forecast days.
 */

export type BillingModel = "flat" | "per-day" | "per-period";

export interface MeasuredEndpoint {
  name: string;
  /** Accesses charged per request at the current settings. */
  tokensPerRequest: number;
  /** Temporal multiplier reported by the provider, if any. */
  temporal: number | null;
}

export interface BudgetOption {
  intervalHours: 1 | 3;
  days: number;
  monthly: number;
  fits: boolean;
}

/** Parse "endpoint=1; spatial=1; temporal=8" → 8. */
export function temporalMultiplier(multipliers: readonly string[]): number | null {
  for (const text of multipliers) {
    const match = /temporal\s*=\s*(\d+(?:\.\d+)?)/i.exec(text);
    if (match) return Number(match[1]);
  }
  return null;
}

/** Decide how a request is billed from its temporal multiplier at known settings. */
export function detectBilling(temporal: number | null, days: number, intervalHours: number): BillingModel {
  if (temporal === null || temporal <= 1) return "flat";
  // Requests run from local midnight today, so they span days + 1 calendar days.
  const dayCount = days + 1;
  const periodCount = (dayCount * 24) / intervalHours;
  return Math.abs(temporal - dayCount) <= Math.abs(temporal - periodCount) ? "per-day" : "per-period";
}

function scale(model: BillingModel, from: { days: number; intervalHours: number }, to: { days: number; intervalHours: number }) {
  if (model === "flat") return 1;
  if (model === "per-day") return (to.days + 1) / (from.days + 1);
  return ((to.days + 1) * 24) / to.intervalHours / (((from.days + 1) * 24) / from.intervalHours);
}

/**
 * Project monthly usage for each supported setting, in order of preference
 * (most forecast detail first). `fits` marks options within the budget.
 */
export function planBudget(input: {
  endpoints: MeasuredEndpoint[];
  current: { days: number; intervalHours: 1 | 3 };
  spots: number;
  refreshesPerDay: number;
  budget: number;
  monthDays?: number;
}): BudgetOption[] {
  const monthDays = input.monthDays ?? 31;
  const options: { intervalHours: 1 | 3; days: number }[] = [
    { intervalHours: 1, days: 7 },
    { intervalHours: 3, days: 7 },
    { intervalHours: 1, days: 5 },
    { intervalHours: 3, days: 5 },
  ];
  return options.map((option) => {
    const perSpot = input.endpoints.reduce((sum, endpoint) => {
      const model = detectBilling(endpoint.temporal, input.current.days, input.current.intervalHours);
      return sum + endpoint.tokensPerRequest * scale(model, input.current, option);
    }, 0);
    const monthly = Math.ceil(perSpot * input.spots * input.refreshesPerDay * monthDays);
    return { ...option, monthly, fits: monthly <= input.budget };
  });
}
