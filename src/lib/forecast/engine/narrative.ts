import type { HourlyConditions, SurfWindow, WindConditions } from "@/types/forecast";
import { formatSurfRange, formatTimeRange } from "@/lib/format";
import { degreesToCompass, directionAdjective } from "./angles";
import { GLASSY_KMH, windStrength } from "./wind";

/**
 * WRITTEN FORECAST
 * ----------------
 * Produces a short, surfer-style forecast, one sentence per line:
 *
 *   3-4ft clean surf.
 *   Long-period WNW swell.
 *   Light offshore easterly winds.
 *   Best between 7am–11am around mid tide.
 */

export function describeSurfQuality(wind: WindConditions | null): string {
  if (!wind) return "surf";
  const { speedKmh, type } = wind;
  if (speedKmh < GLASSY_KMH) return "glassy surf";
  if (type === "offshore" || type === "cross-offshore") {
    if (speedKmh >= 45) return "wind-blown surf";
    return speedKmh < 29 ? "clean surf" : "groomed but gusty surf";
  }
  if (type === "cross-shore") return speedKmh < 15 ? "fairly clean surf" : "bumpy surf";
  if (speedKmh < 12) return "slightly textured surf";
  return speedKmh < 29 ? "choppy surf" : "blown-out surf";
}

export function describeSwell(hour: HourlyConditions): string | null {
  const swell = hour.primarySwell;
  if (!swell) return null;
  const periodClass = swell.periodS >= 12 ? "Long-period" : swell.periodS >= 9 ? "Mid-period" : "Short-period";
  const direction = degreesToCompass(swell.directionDeg);
  return `${periodClass} ${direction} swell (${swell.heightM.toFixed(1)}m at ${Math.round(swell.periodS)}s).`;
}

export function describeWind(wind: WindConditions | null): string {
  if (!wind) return "Wind data unavailable.";
  const strength = windStrength(wind.speedKmh);
  if (strength === "calm") return "Calm, near-windless conditions.";
  const capitalised = strength.charAt(0).toUpperCase() + strength.slice(1);
  return `${capitalised} ${wind.type} ${directionAdjective(wind.directionDeg)} winds.`;
}

export function describeWindow(window: SurfWindow | null): string {
  if (!window) return "No clear window — conditions stay poor through daylight hours.";
  const tide = window.tidePhase
    ? ` around ${window.tidePhase} tide${window.tideTrend === "rising" && window.tidePhase !== "high" ? " on the push" : ""}`
    : "";
  return `Best between ${formatTimeRange(window.start, window.end)}${tide}.`;
}

/** Note an afternoon change in wind type, e.g. "Wind turns onshore by 3pm." */
export function describeWindChange(representative: HourlyConditions, daylight: readonly HourlyConditions[]): string | null {
  const baseType = representative.wind?.type;
  if (!baseType) return null;
  const rank = { offshore: 0, "cross-offshore": 1, "cross-shore": 2, onshore: 3 } as const;
  const later = daylight.find(
    (hour) =>
      hour.time > representative.time &&
      hour.wind &&
      hour.wind.speedKmh >= 12 &&
      rank[hour.wind.type] - rank[baseType] >= 2,
  );
  if (!later?.wind) return null;
  return `Wind turns ${later.wind.type} later in the day.`;
}

export function buildSummary(
  representative: HourlyConditions,
  window: SurfWindow | null,
  daylight: readonly HourlyConditions[],
  /** Surf range shown for the day (across the best window), so text and headline numbers agree. */
  range: { minFt: number; maxFt: number } = { minFt: representative.surfMinFt, maxFt: representative.surfMaxFt },
): string[] {
  if (range.maxFt === 0) {
    return ["Flat or near-flat conditions.", describeSwell(representative), describeWind(representative.wind)].filter(
      (line): line is string => line !== null,
    );
  }
  const size = formatSurfRange(range.minFt, range.maxFt);
  const headline =
    range.maxFt <= 1
      ? `Tiny ${size} ${describeSurfQuality(representative.wind)}.`
      : `${size} ${describeSurfQuality(representative.wind)}.`;
  return [
    headline,
    describeSwell(representative),
    describeWind(representative.wind),
    describeWindChange(representative, daylight),
    describeWindow(window),
  ].filter((line): line is string => line !== null);
}
