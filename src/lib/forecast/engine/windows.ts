import type { HourlyConditions, SurfWindow } from "@/types/forecast";
import { mean } from "./math";
import { RATING_THRESHOLDS } from "./scoring";

/**
 * BEST SURF WINDOW
 * ----------------
 * Within the daylight hours of a day we find the peak-scoring hour, then grow
 * a window around it, always extending towards the better neighbouring hour,
 * while hours stay within 1.2 points of the peak (and at least Fair). Windows
 * are capped at six hours so the advice stays specific ("7am–11am") rather
 * than "all day". No window is returned when the peak is below Fair.
 */

const MAX_WINDOW_HOURS = 6;
const TOLERANCE = 1.2;

export function findBestWindow(hours: readonly HourlyConditions[]): SurfWindow | null {
  const daylight = hours.filter((hour) => hour.isDaylight);
  if (daylight.length === 0) return null;

  let peakIndex = 0;
  daylight.forEach((hour, index) => {
    if (hour.score > daylight[peakIndex]!.score) peakIndex = index;
  });
  const peak = daylight[peakIndex]!;
  const minimum = RATING_THRESHOLDS[0];
  if (peak.score < minimum) return null;

  const threshold = Math.max(peak.score - TOLERANCE, minimum);
  let start = peakIndex;
  let end = peakIndex;
  while (end - start + 1 < MAX_WINDOW_HOURS) {
    const before = daylight[start - 1];
    const after = daylight[end + 1];
    const canExtendBefore = before !== undefined && before.score >= threshold && isConsecutive(before, daylight[start]!);
    const canExtendAfter = after !== undefined && after.score >= threshold && isConsecutive(daylight[end]!, after);
    if (canExtendBefore && (!canExtendAfter || before.score >= after.score)) start -= 1;
    else if (canExtendAfter) end += 1;
    else break;
  }

  const windowHours = daylight.slice(start, end + 1);
  const last = windowHours[windowHours.length - 1]!;
  return {
    start: windowHours[0]!.time,
    end: last.time + 3600,
    score: Math.round(mean(windowHours.map((hour) => hour.score)) * 10) / 10,
    tidePhase: peak.tide?.phase ?? null,
    tideTrend: peak.tide?.trend ?? null,
  };
}

function isConsecutive(a: HourlyConditions, b: HourlyConditions): boolean {
  return b.time - a.time === 3600;
}
