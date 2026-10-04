/**
 * Domain types shared by the forecast engine, the data layer and the UI.
 *
 * Internal units are always metric (metres, seconds, km/h, °C, degrees true).
 * Conversion to surfer-friendly units (feet, mph) happens only at the edges
 * (narrative text and formatting helpers).
 */

export const COMPASS_POINTS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
] as const;
export type CompassPoint = (typeof COMPASS_POINTS)[number];

export const SKILL_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const TIDE_PHASES = ["low", "mid", "high"] as const;
export type TidePhase = (typeof TIDE_PHASES)[number];
export type TideTrend = "rising" | "falling";

export const WIND_TYPES = ["offshore", "cross-offshore", "cross-shore", "onshore"] as const;
export type WindType = (typeof WIND_TYPES)[number];

export type StarRating = 1 | 2 | 3 | 4 | 5;
export const RATING_LABELS = ["Poor", "Fair", "Good", "Excellent", "Epic"] as const;
export type RatingLabel = (typeof RATING_LABELS)[number];

export type SuitabilityLevel = "ideal" | "good" | "marginal" | "unsuitable";

export interface Suitability {
  level: SuitabilityLevel;
  reason: string;
}

export interface SwellComponent {
  heightM: number;
  periodS: number;
  directionDeg: number;
}

export interface WindConditions {
  speedKmh: number;
  gustKmh: number | null;
  directionDeg: number;
  type: WindType;
}

export interface TideState {
  heightM: number;
  phase: TidePhase;
  trend: TideTrend;
}

export interface TideEvent {
  /** Unix seconds (UTC). */
  time: number;
  type: "high" | "low";
  heightM: number;
}

/** Breakdown of the 0–1 component scores that make up an hourly score. */
export interface ScoreBreakdown {
  size: number;
  period: number;
  wind: number;
  direction: number;
  tideFactor: number;
}

export interface HourlyConditions {
  /** Unix seconds (UTC) at the start of the hour. */
  time: number;
  isDaylight: boolean;
  /** Significant height of the combined sea state (swell + wind sea). */
  waveHeightM: number | null;
  /** Estimated breaking wave face height range at the beach, in feet. */
  surfMinFt: number;
  surfMaxFt: number;
  primarySwell: SwellComponent | null;
  secondarySwell: SwellComponent | null;
  wind: WindConditions | null;
  airTempC: number | null;
  seaTempC: number | null;
  weatherCode: number | null;
  tide: TideState | null;
  /** Overall quality score, 0–10. */
  score: number;
  rating: StarRating;
  breakdown: ScoreBreakdown;
}

export interface SurfWindow {
  start: number;
  /** Exclusive end (unix seconds) — i.e. the end of the last good hour. */
  end: number;
  score: number;
  tidePhase: TidePhase | null;
  tideTrend: TideTrend | null;
}

export interface DayForecast {
  /** Local (Europe/London) calendar date, YYYY-MM-DD. */
  date: string;
  sunrise: number | null;
  sunset: number | null;
  score: number;
  rating: StarRating;
  label: RatingLabel;
  surfMinFt: number;
  surfMaxFt: number;
  /** Representative conditions at the best time of day. */
  primarySwell: SwellComponent | null;
  wind: WindConditions | null;
  airTempMinC: number | null;
  airTempMaxC: number | null;
  seaTempC: number | null;
  weatherCode: number | null;
  tideEvents: TideEvent[];
  bestWindow: SurfWindow | null;
  suitability: Record<SkillLevel, Suitability>;
  /** Short written forecast, one sentence per line. */
  summary: string[];
}

export interface SpotForecast {
  slug: string;
  generatedAt: number;
  /** True when at least some marine data was available for this spot. */
  hasMarineData: boolean;
  days: DayForecast[];
  hourly: HourlyConditions[];
  sources: string[];
}

/**
 * Status of a forecast bundle:
 *  - live:        fetched during this request
 *  - cached:      served from the cache, still within its refresh slot
 *  - stale:       live refresh failed; serving the last good forecast
 *  - sample:      synthetic sample data (FORECAST_DATA_SOURCE=sample)
 *  - unavailable: no live data and nothing cached
 */
export type BundleStatus = "live" | "cached" | "stale" | "sample" | "unavailable";

export interface ForecastBundle {
  version: number;
  generatedAt: number;
  status: BundleStatus;
  /** Time the next scheduled refresh is due (unix seconds). */
  nextRefreshAt: number;
  sources: string[];
  errors: string[];
  spots: Record<string, SpotForecast>;
}
