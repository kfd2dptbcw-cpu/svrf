import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";
import { isFresh, latestRefreshSlot, longestSlotGap, maxCacheAgeSeconds, nextRefreshSlot } from "@/lib/schedule";

const at = (iso: string) => Date.parse(iso) / 1000;
const HOUR = 3600;

describe("refresh schedule", () => {
  it("defaults to one refresh a day at 06:00 UTC", () => {
    const saved = process.env.REFRESH_HOURS_UTC;
    delete process.env.REFRESH_HOURS_UTC;
    try {
      expect(env.refreshHoursUtc).toEqual([6]);
    } finally {
      if (saved !== undefined) process.env.REFRESH_HOURS_UTC = saved;
    }
  });

  describe("single daily slot", () => {
    const hours = [6];

    it("finds the latest and next slot", () => {
      expect(latestRefreshSlot(at("2026-10-04T10:00:00Z"), hours)).toBe(at("2026-10-04T06:00:00Z"));
      expect(latestRefreshSlot(at("2026-10-04T03:00:00Z"), hours)).toBe(at("2026-10-03T06:00:00Z"));
      expect(nextRefreshSlot(at("2026-10-04T10:00:00Z"), hours)).toBe(at("2026-10-05T06:00:00Z"));
      expect(nextRefreshSlot(at("2026-10-04T03:00:00Z"), hours)).toBe(at("2026-10-04T06:00:00Z"));
    });

    it("keeps a forecast fresh for 26 hours", () => {
      expect(longestSlotGap(hours)).toBe(24 * HOUR);
      expect(maxCacheAgeSeconds(hours)).toBe(26 * HOUR);
    });

    it("does not go stale in the evening", () => {
      const generated = at("2026-10-04T06:07:00Z");
      expect(isFresh(generated, at("2026-10-04T18:30:00Z"), hours)).toBe(true);
      expect(isFresh(generated, at("2026-10-04T23:59:00Z"), hours)).toBe(true);
    });

    it("stays fresh past the next 06:00 slot while the next refresh runs late", () => {
      const generated = at("2026-10-04T06:07:00Z");
      expect(isFresh(generated, at("2026-10-05T06:00:00Z"), hours)).toBe(true);
      expect(isFresh(generated, at("2026-10-05T08:00:00Z"), hours)).toBe(true);
    });

    it("turns stale once a daily refresh has clearly been missed", () => {
      const generated = at("2026-10-04T06:07:00Z");
      expect(isFresh(generated, at("2026-10-05T08:07:00Z"), hours)).toBe(false);
      expect(isFresh(generated, at("2026-10-06T07:00:00Z"), hours)).toBe(false);
    });

    it("never treats a missing forecast as fresh", () => {
      expect(isFresh(0, at("2026-10-04T07:00:00Z"), hours)).toBe(false);
    });
  });

  describe("several slots a day", () => {
    it("uses the longest gap between slots", () => {
      expect(maxCacheAgeSeconds([6, 18])).toBe(14 * HOUR);
      expect(maxCacheAgeSeconds([0, 6, 18])).toBe(14 * HOUR);
      expect(longestSlotGap([3, 9, 23])).toBe(14 * HOUR);
    });

    it("finds the latest and next slot", () => {
      const hours = [6, 18];
      expect(latestRefreshSlot(at("2026-10-04T19:30:00Z"), hours)).toBe(at("2026-10-04T18:00:00Z"));
      expect(latestRefreshSlot(at("2026-10-04T03:00:00Z"), hours)).toBe(at("2026-10-03T18:00:00Z"));
      expect(nextRefreshSlot(at("2026-10-04T10:00:00Z"), hours)).toBe(at("2026-10-04T18:00:00Z"));
      expect(nextRefreshSlot(at("2026-10-04T20:00:00Z"), hours)).toBe(at("2026-10-05T06:00:00Z"));
    });
  });
});
