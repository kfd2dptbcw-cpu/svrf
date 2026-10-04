import type { SwellComponent } from "@/types/forecast";
import { distanceOutsideArc, angularDifference, arcWidth, isWithinArc } from "./angles";
import { clamp, interpolate, METRES_TO_FEET } from "./math";

/**
 * SURF SIZE ESTIMATION
 * --------------------
 * Wave models forecast deep-water significant wave height (Hs) offshore. What
 * a surfer cares about is the face height of the breaking waves at the beach,
 * which depends on:
 *
 *  1. Period — long-period groundswell shoals more as it reaches shallow water,
 *     so a 1.5 m @ 14 s swell breaks much bigger than a 1.5 m @ 7 s windswell.
 *     We apply an empirical period multiplier (≈0.7× at 6 s up to 1.5× at 16 s),
 *     consistent with the face-height conventions used by UK forecasters.
 *  2. Exposure — swell arriving from outside a spot's swell window is blocked
 *     or heavily refracted. Inside the window we lose up to 25% towards the
 *     edges; beyond the edges size decays quickly to 10% over 45°.
 *  3. Local calibration — a per-spot `sizeFactor` from the config that
 *     captures bathymetry, shadowing and how "big" a beach breaks.
 *
 * Swell trains are combined energetically (root-sum-of-squares), which is how
 * independent wave trains add. The wind-sea component contributes at half
 * weight because short, steep wind waves rarely produce rideable surf.
 */

const PERIOD_FACTOR: readonly (readonly [number, number])[] = [
  [5, 0.6],
  [6, 0.7],
  [8, 0.85],
  [10, 1.05],
  [12, 1.25],
  [14, 1.4],
  [16, 1.5],
];

export interface SwellExposure {
  window: readonly [number, number];
  optimal: number;
}

/**
 * Fraction of swell energy that reaches the spot from a given direction, 0.1–1.
 */
export function directionFactor(directionDeg: number, exposure: SwellExposure): number {
  const [from, to] = exposure.window;
  if (isWithinArc(directionDeg, from, to)) {
    const halfWidth = arcWidth(from, to) / 2;
    const offOptimal = Math.min(angularDifference(directionDeg, exposure.optimal), halfWidth);
    return 1 - 0.25 * (offOptimal / halfWidth) ** 2;
  }
  const outside = distanceOutsideArc(directionDeg, from, to);
  return clamp(0.75 - (0.65 * outside) / 45, 0.1, 0.75);
}

export function periodFactor(periodS: number): number {
  return interpolate(periodS, PERIOD_FACTOR);
}

/** Breaking face height in feet for a single swell train. */
export function swellFaceHeightFt(swell: SwellComponent, exposure: SwellExposure, sizeFactor: number): number {
  return (
    swell.heightM * METRES_TO_FEET * periodFactor(swell.periodS) * directionFactor(swell.directionDeg, exposure) * sizeFactor
  );
}

export interface SurfSizeInput {
  primary: SwellComponent | null;
  secondary: SwellComponent | null;
  windWaveHeightM: number | null;
  /** Combined Hs; used when the model doesn't split out swell components. */
  totalWaveHeightM: number | null;
  totalWavePeriodS: number | null;
  totalWaveDirectionDeg: number | null;
}

/** Estimated breaking face height range [min, max] in feet, rounded for display. */
export function estimateSurfHeightFt(
  input: SurfSizeInput,
  exposure: SwellExposure,
  sizeFactor: number,
): { minFt: number; maxFt: number; rawFt: number } {
  let energy = 0;
  if (input.primary) energy += swellFaceHeightFt(input.primary, exposure, sizeFactor) ** 2;
  if (input.secondary) energy += swellFaceHeightFt(input.secondary, exposure, sizeFactor) ** 2;
  if (input.windWaveHeightM !== null) {
    energy += (input.windWaveHeightM * METRES_TO_FEET * 0.5 * sizeFactor) ** 2;
  }
  if (!input.primary && input.totalWaveHeightM !== null && input.totalWavePeriodS !== null) {
    const fallback: SwellComponent = {
      heightM: input.totalWaveHeightM,
      periodS: input.totalWavePeriodS,
      directionDeg: input.totalWaveDirectionDeg ?? exposure.optimal,
    };
    energy += swellFaceHeightFt(fallback, exposure, sizeFactor) ** 2;
  }

  const rawFt = Math.sqrt(energy);
  return { ...surfRange(rawFt), rawFt };
}

/**
 * Convert a face height into the conventional "min–max ft" range: sets are
 * near the upper value, average waves about 30% smaller.
 */
export function surfRange(faceFt: number): { minFt: number; maxFt: number } {
  if (faceFt < 0.35) return { minFt: 0, maxFt: 0 };
  const maxFt = Math.max(1, Math.round(faceFt + 0.25));
  const minFt = clamp(Math.round(faceFt * 0.7), maxFt <= 1 ? 0 : 1, maxFt - 1);
  return { minFt, maxFt };
}
