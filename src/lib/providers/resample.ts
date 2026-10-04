import type { Series } from "./types";

/**
 * Resample coarser series (e.g. Xweather 3-hourly, used to save API accesses)
 * onto the hourly grid the forecast engine expects.
 *
 *   linear    heights, periods, temperatures, speeds, sea level
 *   circular  directions (interpolated the short way round, so 350° → 10° passes 0°)
 *   step      categorical values such as weather codes (previous value holds)
 */
export type ResampleMode = "linear" | "circular" | "step";

export function hourlyTimes(times: readonly number[]): number[] {
  if (times.length === 0) return [];
  const first = times[0]!;
  const last = times[times.length - 1]!;
  const result: number[] = [];
  for (let t = first; t <= last; t += 3600) result.push(t);
  return result;
}

export function resampleSeries(times: readonly number[], values: Series, target: readonly number[], mode: ResampleMode): Series {
  return target.map((t) => {
    // Index of the last source sample at or before t.
    let lo = 0;
    let hi = times.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (times[mid]! <= t) lo = mid;
      else hi = mid - 1;
    }
    const t0 = times[lo]!;
    const v0 = values[lo] ?? null;
    if (t0 === t || mode === "step") return v0;
    const t1 = times[lo + 1];
    const v1 = values[lo + 1] ?? null;
    if (t1 === undefined || v0 === null || v1 === null) return null;
    const fraction = (t - t0) / (t1 - t0);
    if (mode === "circular") {
      const delta = ((((v1 - v0) % 360) + 540) % 360) - 180;
      return Math.round((((v0 + delta * fraction) % 360) + 360) % 360);
    }
    return Math.round((v0 + (v1 - v0) * fraction) * 100) / 100;
  });
}
