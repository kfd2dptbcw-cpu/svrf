import { describe, expect, it } from "vitest";
import { sunTimes } from "@/lib/sun";

const at = (iso: string) => Date.parse(iso) / 1000;
const minutesBetween = (a: number, b: number) => Math.abs(a - b) / 60;

describe("sun times", () => {
  it("matches published London times at the summer solstice", () => {
    // London, 21 June 2026: sunrise ≈ 03:43 UTC, sunset ≈ 20:21 UTC.
    const { sunrise, sunset } = sunTimes(at("2026-06-21T12:00:00Z"), 51.5074, -0.1278);
    expect(minutesBetween(sunrise!, at("2026-06-21T03:43:00Z"))).toBeLessThan(4);
    expect(minutesBetween(sunset!, at("2026-06-21T20:21:00Z"))).toBeLessThan(4);
  });

  it("gives much shorter days in the north in winter", () => {
    const { sunrise, sunset } = sunTimes(at("2026-12-21T12:00:00Z"), 58.597, -3.505); // Thurso
    const hours = (sunset! - sunrise!) / 3600;
    expect(hours).toBeGreaterThan(6);
    expect(hours).toBeLessThan(7.5);
  });
});
