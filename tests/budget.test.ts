import { describe, expect, it } from "vitest";
import { detectBilling, planBudget, temporalMultiplier } from "@/lib/providers/budget";

describe("Xweather budget planning", () => {
  it("reads the temporal multiplier from the header", () => {
    expect(temporalMultiplier(["endpoint=1; spatial=1; temporal=8"])).toBe(8);
    expect(temporalMultiplier([])).toBeNull();
  });

  it("infers flat, per-day and per-period billing", () => {
    expect(detectBilling(1, 7, 1)).toBe("flat");
    expect(detectBilling(8, 7, 1)).toBe("per-day"); // 7 days from today = 8 calendar days
    expect(detectBilling(192, 7, 1)).toBe("per-period"); // 8 days × 24 hourly periods
  });

  it("keeps the current settings when flat billing fits the budget", () => {
    const options = planBudget({
      endpoints: [
        { name: "/maritime", tokensPerRequest: 1, temporal: 1 },
        { name: "/forecasts", tokensPerRequest: 1, temporal: 1 },
      ],
      current: { days: 7, intervalHours: 1 },
      spots: 34,
      refreshesPerDay: 2,
      budget: 12000,
    });
    // 2 accesses × 34 spots × 2 refreshes × 31 days = 4,216
    expect(options[0]).toMatchObject({ intervalHours: 1, days: 7, monthly: 4216, fits: true });
  });

  it("finds that per-day billing needs fewer days, and per-period billing fits nothing", () => {
    const perDay = planBudget({
      endpoints: [
        { name: "/maritime", tokensPerRequest: 8, temporal: 8 },
        { name: "/forecasts", tokensPerRequest: 1, temporal: 1 },
      ],
      current: { days: 7, intervalHours: 1 },
      spots: 34,
      refreshesPerDay: 2,
      budget: 12000,
    });
    // 7 days: (8 + 1) × 2,108 = 18,972; 5 days: (6 + 1) × 2,108 = 14,756 — neither fits.
    expect(perDay.map((option) => option.fits)).toEqual([false, false, false, false]);

    const perPeriod = planBudget({
      endpoints: [{ name: "/maritime", tokensPerRequest: 192, temporal: 192 }],
      current: { days: 7, intervalHours: 1 },
      spots: 34,
      refreshesPerDay: 2,
      budget: 12000,
    });
    expect(perPeriod.find((option) => option.intervalHours === 3 && option.days === 5)?.monthly).toBe(48 * 2108);
  });
});
