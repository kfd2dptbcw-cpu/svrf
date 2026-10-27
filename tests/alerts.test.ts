import { describe, expect, it } from "vitest";
import { ALERT_ID_BASE, alertIds, planAlerts, type AlertSettings } from "@/lib/alerts";
import type { CompactDay, SpotListItem } from "@/lib/forecast/selectors";

function day(date: string, rating: number, overrides: Partial<CompactDay> = {}): CompactDay {
  return {
    date,
    rating: rating as CompactDay["rating"],
    score: rating * 20,
    label: ["Poor", "Fair", "Good", "Excellent", "Epic"][rating - 1] ?? "Poor",
    surfMinFt: 2,
    surfMaxFt: 4,
    windType: "offshore",
    windSpeedKmh: 10,
    windDirectionDeg: 90,
    swellDirectionDeg: 280,
    swellPeriodS: 11,
    bestWindow: null,
    suitability: { beginner: "good", intermediate: "good", advanced: "good" },
    headline: "",
    ...overrides,
  };
}

function spot(slug: string, name: string, days: Record<string, CompactDay>): SpotListItem {
  return {
    slug,
    name,
    region: "cornwall",
    regionName: "Cornwall",
    path: `/surf/cornwall/${slug}`,
    lat: 50,
    lon: -5,
    breakType: "beach",
    skillLevels: ["beginner"],
    days,
  };
}

const settings: AlertSettings = { enabled: true, minRating: 3, hour: 18 };
const now = new Date(2026, 9, 27, 10, 0, 0); // 27 Oct 2026, 10:00 local
const today = "2026-10-27";

describe("planAlerts", () => {
  it("plans an evening-before alert when tomorrow reaches the minimum rating", () => {
    const fistral = spot("fistral", "Fistral Beach", { "2026-10-28": day("2026-10-28", 4) });
    const plan = planAlerts([fistral], ["fistral"], settings, today, now);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.id).toBe(ALERT_ID_BASE);
    expect(plan[0]!.at).toEqual(new Date(2026, 9, 27, 18, 0, 0));
    expect(plan[0]!.title).toBe("Surf tomorrow: Fistral Beach");
    expect(plan[0]!.body).toContain("2-4ft");
    expect(plan[0]!.body).toContain("Excellent");
  });

  it("skips days below the minimum rating", () => {
    const fistral = spot("fistral", "Fistral Beach", { "2026-10-28": day("2026-10-28", 2) });
    expect(planAlerts([fistral], ["fistral"], settings, today, now)).toEqual([]);
  });

  it("only considers favourite spots", () => {
    const fistral = spot("fistral", "Fistral Beach", { "2026-10-28": day("2026-10-28", 5) });
    expect(planAlerts([fistral], ["porthleven"], settings, today, now)).toEqual([]);
  });

  it("returns nothing when disabled or with no favourites", () => {
    const fistral = spot("fistral", "Fistral Beach", { "2026-10-28": day("2026-10-28", 5) });
    expect(planAlerts([fistral], ["fistral"], { ...settings, enabled: false }, today, now)).toEqual([]);
    expect(planAlerts([fistral], [], settings, today, now)).toEqual([]);
  });

  it("skips an evening that has already passed", () => {
    const late = new Date(2026, 9, 27, 19, 0, 0);
    const fistral = spot("fistral", "Fistral Beach", {
      "2026-10-28": day("2026-10-28", 5),
      "2026-10-29": day("2026-10-29", 5),
    });
    const plan = planAlerts([fistral], ["fistral"], settings, today, late);
    expect(plan.map((alert) => alert.id)).toEqual([ALERT_ID_BASE + 1]);
  });

  it("picks the best spot and mentions the others", () => {
    const a = spot("a", "Spot A", { "2026-10-28": day("2026-10-28", 3) });
    const b = spot("b", "Spot B", { "2026-10-28": day("2026-10-28", 5) });
    const plan = planAlerts([a, b], ["a", "b"], settings, today, now);
    expect(plan[0]!.title).toBe("Surf tomorrow: Spot B");
    expect(plan[0]!.body).toContain("Plus 1 more");
  });

  it("uses ids within the cancel range", () => {
    expect(alertIds()).toContain(ALERT_ID_BASE);
    expect(alertIds()).toHaveLength(7);
  });
});
