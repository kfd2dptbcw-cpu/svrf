import { RATING_LABELS, type RatingLabel, type ScoreBreakdown, type StarRating, type SwellComponent, type TideState, type WindConditions } from "@/types/forecast";
import { clamp, interpolate } from "./math";
import { directionFactor } from "./size";
import type { EngineSpot } from "./types";
import { windScore } from "./wind";

/**
 * SURF QUALITY SCORING ALGORITHM
 * ==============================
 * Every hour gets a score from 0 to 10, built from five factors that mirror
 * how an experienced surfer reads a forecast:
 *
 *   factor              weight   what it measures
 *   ------------------  ------   -------------------------------------------
 *   Size                 0.38    Breaking face height vs the spot's typical
 *                                working range (config `waveRangeFt`).
 *   Period               0.20    Swell period — longer period = more power
 *                                and better organised lines.
 *   Wind                 0.32    Wind direction relative to the beach and
 *                                wind strength (see wind.ts).
 *   Swell direction      0.10    How squarely the swell hits the spot,
 *                                relative to its swell window.
 *   Tide (multiplier)    ×       Penalises the wrong stage of tide in
 *                                proportion to the spot's tide sensitivity.
 *
 *   quality = (0.38·size + 0.20·period + 0.32·wind + 0.10·direction) × tide
 *   score   = 10 × quality^1.6
 *
 * The 1.6 exponent stretches the top of the scale: a day has to be good in
 * every respect to reach Excellent or Epic, while "a bit of everything"
 * (small, short-period, light onshore) lands in Fair — matching how UK surfers
 * actually rate days.
 *
 * Then two "gates" stop a single great factor hiding a fatal flaw:
 *   • no surf (≤ 1 ft)                           → capped at 1.0 (Poor)
 *   • under 2 ft, well below the spot's range,
 *     or blown-out wind                           → capped at 4.4 (Fair)
 *   • under 4 ft                                  → capped at 8.4 (Excellent;
 *     "Epic" needs genuine size)
 *
 * The score maps to stars and labels:
 *   < 2.5      ★       Poor
 *   2.5 – 4.5  ★★      Fair
 *   4.5 – 6.5  ★★★     Good
 *   6.5 – 8.5  ★★★★    Excellent
 *   ≥ 8.5      ★★★★★   Epic
 */

export const WEIGHTS = { size: 0.38, period: 0.2, wind: 0.32, direction: 0.1 } as const;
export const QUALITY_EXPONENT = 1.6;
export const RATING_THRESHOLDS = [2.5, 4.5, 6.5, 8.5] as const;
export const FLAT_BELOW_FT = 1.25;
export const EPIC_MIN_FT = 4;

/**
 * Size score, 0–1. Zero below 1.25 ft (anything that rounds to "1ft" or
 * less is effectively flat); ramps from 0.1 to 0.55 at the
 * spot's minimum working size, peaks at the "sweet spot" 60% of the way
 * through its range, eases to 0.85 at the top of the range and then falls
 * away as the spot maxes out (close-outs, unpaddleable, dangerous).
 */
export function sizeScore(faceFt: number, [minFt, maxFt]: readonly [number, number]): number {
  if (faceFt < FLAT_BELOW_FT) return 0;
  if (faceFt < minFt) return 0.1 + (0.45 * (faceFt - 1)) / Math.max(minFt - 1, 0.5);
  const sweetSpot = minFt + 0.6 * (maxFt - minFt);
  if (faceFt <= sweetSpot) return 0.55 + (0.45 * (faceFt - minFt)) / Math.max(sweetSpot - minFt, 0.5);
  if (faceFt <= maxFt) return 1 - (0.15 * (faceFt - sweetSpot)) / Math.max(maxFt - sweetSpot, 0.5);
  return clamp(0.85 - (0.7 * (faceFt - maxFt)) / maxFt, 0.1, 0.85);
}

/** Period score, 0–1, with a penalty below the spot's minimum useful period. */
export function periodScore(periodS: number, minPeriod: number): number {
  const base = interpolate(periodS, [
    [5, 0],
    [7, 0.3],
    [9, 0.55],
    [11, 0.75],
    [13, 0.9],
    [15, 1],
  ]);
  return periodS < minPeriod ? base * 0.7 : base;
}

/** Multiplier for the stage of the tide, 0.4–1. Unknown tide is neutral. */
export function tideFactor(tide: TideState | null, spot: Pick<EngineSpot, "idealTide" | "tideSensitivity">): number {
  if (!tide) return 1;
  return spot.idealTide.includes(tide.phase) ? 1 : 1 - 0.6 * spot.tideSensitivity;
}

export interface HourScoreInput {
  faceFt: number;
  primarySwell: SwellComponent | null;
  wind: WindConditions | null;
  tide: TideState | null;
}

export function scoreHour(input: HourScoreInput, spot: EngineSpot): { score: number; rating: StarRating; breakdown: ScoreBreakdown } {
  const exposure = { window: spot.swellWindow, optimal: spot.optimalSwell };
  const breakdown: ScoreBreakdown = {
    size: sizeScore(input.faceFt, spot.waveRangeFt),
    period: input.primarySwell ? periodScore(input.primarySwell.periodS, spot.minPeriod) : 0,
    // Without wind data we assume average conditions rather than penalising.
    wind: input.wind ? windScore(input.wind.speedKmh, input.wind.type) : 0.5,
    direction: input.primarySwell ? (directionFactor(input.primarySwell.directionDeg, exposure) - 0.1) / 0.9 : 0,
    tideFactor: tideFactor(input.tide, spot),
  };

  const quality =
    (WEIGHTS.size * breakdown.size +
      WEIGHTS.period * breakdown.period +
      WEIGHTS.wind * breakdown.wind +
      WEIGHTS.direction * breakdown.direction) *
    breakdown.tideFactor;
  let score = 10 * clamp(quality, 0, 1) ** QUALITY_EXPONENT;

  if (breakdown.size === 0) score = Math.min(score, 1);
  else if (input.faceFt < 2 || breakdown.size < 0.3 || breakdown.wind < 0.2) score = Math.min(score, 4.4);
  else if (input.faceFt < EPIC_MIN_FT) score = Math.min(score, RATING_THRESHOLDS[3] - 0.1);

  const rounded = Math.round(clamp(score, 0, 10) * 10) / 10;
  return { score: rounded, rating: scoreToRating(rounded), breakdown: roundBreakdown(breakdown) };
}

export function scoreToRating(score: number): StarRating {
  const [fair, good, excellent, epic] = RATING_THRESHOLDS;
  if (score < fair) return 1;
  if (score < good) return 2;
  if (score < excellent) return 3;
  if (score < epic) return 4;
  return 5;
}

export function ratingLabel(rating: StarRating): RatingLabel {
  return RATING_LABELS[rating - 1] ?? "Poor";
}

function roundBreakdown(breakdown: ScoreBreakdown): ScoreBreakdown {
  return {
    size: Math.round(breakdown.size * 100) / 100,
    period: Math.round(breakdown.period * 100) / 100,
    wind: Math.round(breakdown.wind * 100) / 100,
    direction: Math.round(breakdown.direction * 100) / 100,
    tideFactor: Math.round(breakdown.tideFactor * 100) / 100,
  };
}
