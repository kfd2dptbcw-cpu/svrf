import { describe, expect, it } from "vitest";
import { periodScore, ratingLabel, scoreHour, scoreToRating, sizeScore, tideFactor } from "@/lib/forecast/engine/scoring";
import { estimateSurfHeightFt, surfRange } from "@/lib/forecast/engine/size";
import { classifyWind, windScore } from "@/lib/forecast/engine/wind";
import type { EngineSpot } from "@/lib/forecast/engine/types";

/** A Fistral-like west-north-west facing beach. */
const spot: EngineSpot = {
  orientation: 290,
  offshoreDirection: 123.75,
  swellWindow: [225, 0],
  optimalSwell: 292.5,
  minPeriod: 8,
  idealTide: ["low", "mid"],
  tideSensitivity: 0.3,
  waveRangeFt: [2, 8],
  sizeFactor: 1,
  skillLevels: ["beginner", "intermediate", "advanced"],
  breakType: "beach",
};

describe("wind classification", () => {
  it("classifies wind relative to the beach", () => {
    expect(classifyWind(110, 123.75)).toBe("offshore");
    expect(classifyWind(70, 123.75)).toBe("cross-offshore");
    expect(classifyWind(200, 123.75)).toBe("cross-shore");
    expect(classifyWind(290, 123.75)).toBe("onshore");
  });

  it("prefers light offshore winds and penalises strong onshores", () => {
    expect(windScore(3, "onshore")).toBe(1);
    expect(windScore(10, "offshore")).toBe(1);
    expect(windScore(10, "offshore")).toBeGreaterThan(windScore(10, "cross-shore"));
    expect(windScore(35, "onshore")).toBeLessThan(0.05);
  });
});

describe("surf size", () => {
  it("makes long-period swell break bigger than short-period swell of the same height", () => {
    const exposure = { window: spot.swellWindow, optimal: spot.optimalSwell };
    const long = estimateSurfHeightFt(
      { primary: { heightM: 1.5, periodS: 14, directionDeg: 290 }, secondary: null, windWaveHeightM: null, totalWaveHeightM: null, totalWavePeriodS: null, totalWaveDirectionDeg: null },
      exposure,
      1,
    );
    const short = estimateSurfHeightFt(
      { primary: { heightM: 1.5, periodS: 7, directionDeg: 290 }, secondary: null, windWaveHeightM: null, totalWaveHeightM: null, totalWavePeriodS: null, totalWaveDirectionDeg: null },
      exposure,
      1,
    );
    expect(long.rawFt).toBeGreaterThan(short.rawFt * 1.5);
  });

  it("blocks swell from outside the swell window", () => {
    const exposure = { window: spot.swellWindow, optimal: spot.optimalSwell };
    const base = { secondary: null, windWaveHeightM: null, totalWaveHeightM: null, totalWavePeriodS: null, totalWaveDirectionDeg: null };
    const facing = estimateSurfHeightFt({ ...base, primary: { heightM: 2, periodS: 12, directionDeg: 290 } }, exposure, 1);
    const blocked = estimateSurfHeightFt({ ...base, primary: { heightM: 2, periodS: 12, directionDeg: 120 } }, exposure, 1);
    expect(blocked.rawFt).toBeLessThan(facing.rawFt * 0.2);
  });

  it("formats sensible ranges", () => {
    expect(surfRange(0.2)).toEqual({ minFt: 0, maxFt: 0 });
    expect(surfRange(1.4)).toEqual({ minFt: 1, maxFt: 2 });
    expect(surfRange(3.6)).toEqual({ minFt: 3, maxFt: 4 });
    expect(surfRange(6.1)).toEqual({ minFt: 4, maxFt: 6 });
  });
});

describe("score components", () => {
  it("peaks size score in the spot's sweet spot", () => {
    expect(sizeScore(0.5, [2, 8])).toBe(0);
    expect(sizeScore(5.6, [2, 8])).toBeCloseTo(1, 5);
    expect(sizeScore(5.6, [2, 8])).toBeGreaterThan(sizeScore(2, [2, 8]));
    expect(sizeScore(15, [2, 8])).toBeLessThan(sizeScore(8, [2, 8]));
  });

  it("rewards long-period swell", () => {
    expect(periodScore(14, 8)).toBeGreaterThan(periodScore(9, 8));
    expect(periodScore(7, 8)).toBeLessThan(periodScore(7, 6));
  });

  it("only penalises the wrong tide", () => {
    expect(tideFactor({ heightM: 0, phase: "mid", trend: "rising" }, spot)).toBe(1);
    expect(tideFactor({ heightM: 2, phase: "high", trend: "rising" }, spot)).toBeCloseTo(0.82, 5);
    expect(tideFactor(null, spot)).toBe(1);
  });
});

describe("hour scoring", () => {
  const swell = { heightM: 1.5, periodS: 13, directionDeg: 290 };

  it("rates a clean, long-period, well-sized swell as Excellent or Epic", () => {
    const result = scoreHour(
      { faceFt: 5.5, primarySwell: swell, wind: { speedKmh: 8, gustKmh: 12, directionDeg: 120, type: "offshore" }, tide: null },
      spot,
    );
    expect(result.rating).toBeGreaterThanOrEqual(4);
  });

  it("rates small, short-period onshore slop as Poor or Fair", () => {
    const result = scoreHour(
      {
        faceFt: 2,
        primarySwell: { heightM: 0.6, periodS: 7, directionDeg: 290 },
        wind: { speedKmh: 20, gustKmh: 30, directionDeg: 290, type: "onshore" },
        tide: null,
      },
      spot,
    );
    expect(result.rating).toBeLessThanOrEqual(2);
  });

  it("never rates flat conditions above Poor", () => {
    const result = scoreHour(
      { faceFt: 0.4, primarySwell: swell, wind: { speedKmh: 2, gustKmh: 4, directionDeg: 120, type: "offshore" }, tide: null },
      spot,
    );
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.rating).toBe(1);
  });

  it("caps blown-out conditions at Fair", () => {
    const result = scoreHour(
      { faceFt: 5, primarySwell: swell, wind: { speedKmh: 45, gustKmh: 60, directionDeg: 290, type: "onshore" }, tide: null },
      spot,
    );
    expect(result.score).toBeLessThanOrEqual(4.4);
  });

  it("reserves Epic for surf of at least 4ft", () => {
    const perfect = { primarySwell: { heightM: 1.2, periodS: 15, directionDeg: 292 }, wind: { speedKmh: 2, gustKmh: 3, directionDeg: 124, type: "offshore" as const }, tide: null };
    const smallSpot = { ...spot, waveRangeFt: [1, 4] as const };
    expect(scoreHour({ ...perfect, faceFt: 3.4 }, smallSpot).rating).toBe(4);
    expect(scoreHour({ ...perfect, faceFt: 5.6 }, spot).rating).toBe(5);
  });

  it("maps scores to stars and labels", () => {
    expect(scoreToRating(0)).toBe(1);
    expect(scoreToRating(3)).toBe(2);
    expect(scoreToRating(5)).toBe(3);
    expect(scoreToRating(7)).toBe(4);
    expect(scoreToRating(9)).toBe(5);
    expect(ratingLabel(5)).toBe("Epic");
  });
});
