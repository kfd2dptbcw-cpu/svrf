import { getRegion, spots, type ResolvedSpot } from "@/lib/config";
import { addDaysToKey, nowSeconds, ukDateKey } from "@/lib/time";
import type {
  DayForecast,
  ForecastBundle,
  SkillLevel,
  SpotForecast,
  StarRating,
  SuitabilityLevel,
  WindType,
} from "@/types/forecast";

/**
 * Pure helpers that shape the forecast bundle for pages and for the
 * (deliberately small) payloads sent to client components.
 */

export function todayKey(now = nowSeconds()): string {
  return ukDateKey(now);
}

export function upcomingDateKeys(count: number, now = nowSeconds()): string[] {
  const today = todayKey(now);
  return Array.from({ length: count }, (_, i) => addDaysToKey(today, i));
}

export function getDay(forecast: SpotForecast | null | undefined, dateKey: string): DayForecast | undefined {
  return forecast?.days.find((day) => day.date === dateKey);
}

/** Compact per-day data for client-side lists, filters and the map. */
export interface CompactDay {
  date: string;
  rating: StarRating;
  score: number;
  label: string;
  surfMinFt: number;
  surfMaxFt: number;
  windType: WindType | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  swellDirectionDeg: number | null;
  swellPeriodS: number | null;
  bestWindow: { start: number; end: number } | null;
  suitability: Record<SkillLevel, SuitabilityLevel>;
  headline: string;
}

export interface SpotListItem {
  slug: string;
  name: string;
  region: string;
  regionName: string;
  path: string;
  lat: number;
  lon: number;
  breakType: ResolvedSpot["breakType"];
  skillLevels: SkillLevel[];
  days: Record<string, CompactDay>;
}

export function compactDay(day: DayForecast): CompactDay {
  return {
    date: day.date,
    rating: day.rating,
    score: day.score,
    label: day.label,
    surfMinFt: day.surfMinFt,
    surfMaxFt: day.surfMaxFt,
    windType: day.wind?.type ?? null,
    windSpeedKmh: day.wind?.speedKmh ?? null,
    windDirectionDeg: day.wind?.directionDeg ?? null,
    swellDirectionDeg: day.primarySwell?.directionDeg ?? null,
    swellPeriodS: day.primarySwell?.periodS ?? null,
    bestWindow: day.bestWindow ? { start: day.bestWindow.start, end: day.bestWindow.end } : null,
    suitability: {
      beginner: day.suitability.beginner.level,
      intermediate: day.suitability.intermediate.level,
      advanced: day.suitability.advanced.level,
    },
    headline: day.summary[0] ?? "",
  };
}

export function buildSpotList(bundle: ForecastBundle, dateKeys: readonly string[], subset = spots): SpotListItem[] {
  return subset.map((spot) => {
    const forecast = bundle.spots[spot.slug];
    const days: Record<string, CompactDay> = {};
    for (const key of dateKeys) {
      const day = getDay(forecast, key);
      if (day) days[key] = compactDay(day);
    }
    return {
      slug: spot.slug,
      name: spot.name,
      region: spot.region,
      regionName: getRegion(spot.region)?.name ?? spot.region,
      path: spot.path,
      lat: spot.location.lat,
      lon: spot.location.lon,
      breakType: spot.breakType,
      skillLevels: [...spot.skillLevels],
      days,
    };
  });
}

export interface RankedSpot {
  spot: ResolvedSpot;
  day: DayForecast;
}

/** Spots with a forecast for the given day, best first (score, then size). */
export function rankSpots(bundle: ForecastBundle, dateKey: string, subset: readonly ResolvedSpot[] = spots): RankedSpot[] {
  return subset
    .map((spot) => ({ spot, day: getDay(bundle.spots[spot.slug], dateKey) }))
    .filter((entry): entry is RankedSpot => entry.day !== undefined)
    .sort((a, b) => b.day.score - a.day.score || b.day.surfMaxFt - a.day.surfMaxFt);
}

/** Search index sent to the header search box (tiny: names and URLs only). */
export function searchIndex() {
  return spots.map((spot) => ({
    slug: spot.slug,
    name: spot.name,
    regionName: getRegion(spot.region)?.name ?? spot.region,
    path: spot.path,
  }));
}

export type SearchIndexEntry = ReturnType<typeof searchIndex>[number];
