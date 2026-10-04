import { describe, expect, it } from "vitest";
import { isFresh, latestRefreshSlot, nextRefreshSlot } from "@/lib/schedule";

const at = (iso: string) => Date.parse(iso) / 1000;

describe("refresh schedule", () => {
  const hours = [6, 18];

  it("finds the most recent refresh slot", () => {
    expect(latestRefreshSlot(at("2026-10-04T10:00:00Z"), hours)).toBe(at("2026-10-04T06:00:00Z"));
    expect(latestRefreshSlot(at("2026-10-04T19:30:00Z"), hours)).toBe(at("2026-10-04T18:00:00Z"));
    expect(latestRefreshSlot(at("2026-10-04T03:00:00Z"), hours)).toBe(at("2026-10-03T18:00:00Z"));
  });

  it("finds the next refresh slot", () => {
    expect(nextRefreshSlot(at("2026-10-04T10:00:00Z"), hours)).toBe(at("2026-10-04T18:00:00Z"));
    expect(nextRefreshSlot(at("2026-10-04T20:00:00Z"), hours)).toBe(at("2026-10-05T06:00:00Z"));
  });

  it("treats forecasts generated before the latest slot as stale", () => {
    const now = at("2026-10-04T07:00:00Z");
    expect(isFresh(at("2026-10-04T06:05:00Z"), now)).toBe(true);
    expect(isFresh(at("2026-10-04T05:59:00Z"), now)).toBe(false);
  });
});
