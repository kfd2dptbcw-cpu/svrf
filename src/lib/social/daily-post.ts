import { getRegion, type ResolvedSpot } from "@/lib/config";
import { rankSpots } from "@/lib/forecast/selectors";
import { formatFullDate, formatSurfRange, formatTimeRange, WIND_TYPE_LABELS } from "@/lib/format";
import type { DayForecast, ForecastBundle } from "@/types/forecast";

/**
 * The daily "best of today" social post: which spots to feature, the caption
 * and where its image lives. Pure functions so the card route, the posting
 * script and tests all agree on the same picks.
 */

/** First day the automatic Facebook/Instagram post runs (UK date). */
export const DEFAULT_SOCIAL_START_DATE = "2026-11-03";

export interface FeaturedSpot {
  spot: ResolvedSpot;
  regionName: string;
  day: DayForecast;
}

/**
 * The best spots for a day, at most one per region so the post covers the
 * country rather than three Cornish beaches; topped up from any region if
 * there are fewer regions than `count`. Flat spots are never featured.
 */
export function pickFeaturedSpots(bundle: ForecastBundle, dateKey: string, count = 3): FeaturedSpot[] {
  const ranked = rankSpots(bundle, dateKey).filter(({ day }) => day.surfMaxFt > 0);
  const picked: typeof ranked = [];
  const regionsUsed = new Set<string>();
  for (const entry of ranked) {
    if (picked.length >= count) break;
    if (regionsUsed.has(entry.spot.region)) continue;
    picked.push(entry);
    regionsUsed.add(entry.spot.region);
  }
  for (const entry of ranked) {
    if (picked.length >= count) break;
    if (!picked.includes(entry)) picked.push(entry);
  }
  return picked.map(({ spot, day }) => ({ spot, day, regionName: getRegion(spot.region)?.name ?? spot.region }));
}

export function stars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
}

/** Wind and best window: "Offshore · best 7am–11am". */
export function conditionsDetail(day: DayForecast): string {
  const parts: string[] = [];
  if (day.wind) parts.push(WIND_TYPE_LABELS[day.wind.type]);
  if (day.bestWindow) parts.push(`best ${formatTimeRange(day.bestWindow.start, day.bestWindow.end)}`);
  return parts.join(" · ");
}

/** One-line conditions summary: "3-4ft · Offshore · best 7am–11am". */
export function conditionsLine(day: DayForecast): string {
  return [formatSurfRange(day.surfMinFt, day.surfMaxFt), conditionsDetail(day)].filter(Boolean).join(" · ");
}

export type SocialPlatform = "facebook" | "instagram";

/**
 * Caption for the daily post. Facebook gets a clickable, tagged link;
 * Instagram captions can't hold links, so it points to the link in bio.
 */
export function buildCaption(featured: readonly FeaturedSpot[], dateKey: string, siteUrl: string, platform: SocialPlatform): string {
  const heading = `🌊 Best surf in the UK · ${formatFullDate(dateKey)}`;
  const lines = featured.map(
    ({ spot, regionName, day }, index) =>
      `${index + 1}. ${spot.name}, ${regionName}: ${stars(day.rating)} ${day.label}\n   ${conditionsLine(day)}`,
  );
  const link =
    platform === "facebook"
      ? `Full forecast for every spot 👉 ${siteUrl}/today?utm_source=facebook&utm_medium=social&utm_campaign=daily_best`
      : "Full forecast for all UK spots: link in bio 🔗";
  const question = "Where are you paddling out today? 👇";
  const tags =
    platform === "instagram" ? "\n\n#surf #ukSurf #surfforecast #cornwallsurf #surfing #coldwatersurf #dawnpatrol" : "";
  return [heading, lines.join("\n"), question, link].join("\n\n") + tags;
}

/** Path of the day's card image (JPEG, as Instagram requires). */
export function socialCardPath(dateKey: string): string {
  return `/api/social-card?date=${dateKey}&format=jpeg`;
}

/** Posting is active from the start date onwards (YYYY-MM-DD strings compare correctly). */
export function postingActive(dateKey: string, startDate = DEFAULT_SOCIAL_START_DATE): boolean {
  return dateKey >= startDate;
}
