import type { WindType } from "@/types/forecast";
import { angularDifference, circularMean, normalizeDegrees } from "./angles";
import { clamp, interpolate } from "./math";

/**
 * WIND CLASSIFICATION
 * -------------------
 * Wind quality depends on the angle between where the wind blows FROM and the
 * spot's ideal offshore direction. The ideal offshore direction is the
 * circular mean of the spot's configured preferred winds, falling back to the
 * direction directly opposite the way the beach faces.
 *
 *   0°–30°   offshore         (wind blows from land to sea, grooming waves)
 *   30°–65°  cross-offshore
 *   65°–115° cross-shore
 *   >115°    onshore          (wind blows from sea to land, creating chop)
 */

export function idealOffshoreDirection(orientation: number, preferred: readonly number[]): number {
  return preferred.length > 0 ? circularMean(preferred) : normalizeDegrees(orientation + 180);
}

export function classifyWind(windFromDeg: number, offshoreDeg: number): WindType {
  const delta = angularDifference(windFromDeg, offshoreDeg);
  if (delta <= 30) return "offshore";
  if (delta <= 65) return "cross-offshore";
  if (delta <= 115) return "cross-shore";
  return "onshore";
}

/** Below this speed (km/h) wind direction barely matters: conditions are glassy. */
export const GLASSY_KMH = 5;

/**
 * Wind score, 0–1.
 *
 * Each wind type has a base quality, which is then reduced as the wind gets
 * stronger. Offshore winds tolerate the most strength (although strong
 * offshores hold waves up and make paddling hard); onshore winds degrade
 * quality fastest.
 */
const SPEED_PENALTY: Record<WindType, { base: number; curve: readonly (readonly [number, number])[] }> = {
  offshore: { base: 1, curve: [[12, 1], [25, 0.9], [45, 0.45], [60, 0.25]] },
  "cross-offshore": { base: 0.85, curve: [[10, 1], [25, 0.75], [45, 0.35], [60, 0.2]] },
  "cross-shore": { base: 0.55, curve: [[8, 1], [20, 0.6], [40, 0.15], [55, 0.05]] },
  onshore: { base: 0.3, curve: [[5, 1], [15, 0.6], [30, 0.1], [45, 0]] },
};

export function windScore(speedKmh: number, type: WindType): number {
  if (speedKmh < GLASSY_KMH) return 1;
  const { base, curve } = SPEED_PENALTY[type];
  return clamp(base * interpolate(speedKmh, curve), 0, 1);
}

export type WindStrength = "calm" | "light" | "moderate" | "fresh" | "strong" | "gale";

/** Plain-English wind strength (km/h, broadly following the Beaufort scale). */
export function windStrength(speedKmh: number): WindStrength {
  if (speedKmh < GLASSY_KMH) return "calm";
  if (speedKmh < 15) return "light";
  if (speedKmh < 29) return "moderate";
  if (speedKmh < 39) return "fresh";
  if (speedKmh < 62) return "strong";
  return "gale";
}
