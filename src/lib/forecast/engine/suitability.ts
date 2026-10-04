import type { HourlyConditions, SkillLevel, Suitability } from "@/types/forecast";
import { RATING_THRESHOLDS } from "./scoring";
import type { EngineSpot } from "./types";

/**
 * SKILL SUITABILITY
 * -----------------
 * Evaluated against the representative (best) conditions of the day.
 *
 *  Beginner      Small (≤3 ft), manageable waves and no strong wind, at a
 *                spot configured as beginner-friendly. Reefs never qualify.
 *  Intermediate  2–7 ft is the comfort zone; quality decides ideal vs good.
 *  Advanced      Needs size (≥4 ft) and quality (Excellent+) to be ideal;
 *                small surf is "marginal" — surfable, but not worth the drive.
 */

export function assessSuitability(
  hour: HourlyConditions,
  dayScore: number,
  spot: Pick<EngineSpot, "skillLevels" | "breakType">,
): Record<SkillLevel, Suitability> {
  return {
    beginner: beginner(hour, spot),
    intermediate: intermediate(hour, dayScore, spot),
    advanced: advanced(hour, dayScore),
  };
}

const [FAIR, GOOD, EXCELLENT] = RATING_THRESHOLDS;

function beginner(hour: HourlyConditions, spot: Pick<EngineSpot, "skillLevels" | "breakType">): Suitability {
  const size = hour.surfMaxFt;
  const wind = hour.wind;
  if (spot.breakType === "reef") return { level: "unsuitable", reason: "Reef break — experienced surfers only" };
  if (!spot.skillLevels.includes("beginner")) return { level: "unsuitable", reason: "Not a beginner-friendly spot" };
  if (size === 0) return { level: "unsuitable", reason: "Flat" };
  if (size > 5) return { level: "unsuitable", reason: "Too big and powerful" };
  if (wind && (wind.speedKmh >= 39 || (wind.type === "onshore" && wind.speedKmh >= 29))) {
    return { level: "unsuitable", reason: "Strong winds and messy surf" };
  }
  if (size >= 4) return { level: "marginal", reason: "Getting big — lessons or the inside only" };
  if (size <= 1) return { level: "marginal", reason: "Very small — fine for a first paddle" };
  if (size <= 3 && (!wind || wind.speedKmh < 25)) return { level: "ideal", reason: "Small, manageable waves" };
  return { level: "good", reason: "Manageable, but some wind about" };
}

function intermediate(hour: HourlyConditions, dayScore: number, spot: Pick<EngineSpot, "skillLevels">): Suitability {
  const size = hour.surfMaxFt;
  if (!spot.skillLevels.includes("intermediate") && size >= 3) {
    return { level: "unsuitable", reason: "Expert-level spot at this size" };
  }
  if (size === 0) return { level: "unsuitable", reason: "Flat" };
  if (size > 10) return { level: "unsuitable", reason: "Too big — experts only" };
  if (size > 7) return { level: "marginal", reason: "Big and powerful" };
  if (size < 2) return { level: "marginal", reason: "Small — longboard conditions" };
  if (dayScore >= GOOD) return { level: "ideal", reason: "Fun, quality waves" };
  if (dayScore >= FAIR) return { level: "good", reason: "Surfable, if not perfect" };
  return { level: "marginal", reason: "Poor quality" };
}

function advanced(hour: HourlyConditions, dayScore: number): Suitability {
  const size = hour.surfMaxFt;
  if (size === 0) return { level: "unsuitable", reason: "Flat" };
  if (size < 2) return { level: "marginal", reason: "Too small to be worthwhile" };
  if (dayScore >= EXCELLENT && size >= 4) return { level: "ideal", reason: "Powerful, quality surf" };
  if (dayScore >= GOOD) return { level: "good", reason: "Worth a session" };
  return { level: "marginal", reason: "Below par" };
}
