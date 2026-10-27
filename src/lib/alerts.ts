import { addDaysToKey } from "@/lib/time";
import type { SpotListItem } from "@/lib/forecast/selectors";

/**
 * Surf alerts: pure planning logic. The iPhone app turns the returned plan
 * into local notifications; nothing here touches the device, so it is testable.
 */

export interface AlertSettings {
  enabled: boolean;
  /** Minimum star rating (1-5) that triggers an alert. */
  minRating: number;
  /** Local hour (0-23) the evening-before alert is delivered. */
  hour: number;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = { enabled: false, minRating: 3, hour: 18 };

export interface PlannedAlert {
  id: number;
  at: Date;
  title: string;
  body: string;
}

/** Notification ids used by the plan; used to cancel previously scheduled alerts. */
export const ALERT_ID_BASE = 7000;
export const ALERT_DAYS = 7;

export function alertIds(): number[] {
  return Array.from({ length: ALERT_DAYS }, (_, index) => ALERT_ID_BASE + index);
}

function waveText(minFt: number, maxFt: number): string {
  const lo = Math.round(minFt);
  const hi = Math.round(maxFt);
  return lo === hi ? `${hi}ft` : `${lo}-${hi}ft`;
}

/** Local-time Date for a YYYY-MM-DD key at the given hour. */
function atLocalHour(dateKey: string, hour: number): Date {
  const [year, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day, hour, 0, 0);
}

/**
 * For each of the next ALERT_DAYS evenings, find the favourite spots whose
 * forecast for the following day reaches the minimum rating and plan one
 * notification for the best of them.
 */
export function planAlerts(
  spots: readonly SpotListItem[],
  favourites: readonly string[],
  settings: AlertSettings,
  todayKey: string,
  now: Date,
): PlannedAlert[] {
  if (!settings.enabled || favourites.length === 0) return [];
  const favouriteSpots = spots.filter((spot) => favourites.includes(spot.slug));
  const planned: PlannedAlert[] = [];

  for (let index = 0; index < ALERT_DAYS; index++) {
    const eveningKey = addDaysToKey(todayKey, index);
    const at = atLocalHour(eveningKey, settings.hour);
    if (at.getTime() <= now.getTime() + 60_000) continue;

    const surfDayKey = addDaysToKey(eveningKey, 1);
    const candidates = favouriteSpots
      .map((spot) => ({ spot, day: spot.days[surfDayKey] }))
      .filter((entry): entry is { spot: SpotListItem; day: NonNullable<(typeof entry)["day"]> } => entry.day !== undefined && entry.day.rating >= settings.minRating)
      .sort((a, b) => b.day.rating - a.day.rating || b.day.surfMaxFt - a.day.surfMaxFt);

    const best = candidates[0];
    if (!best) continue;

    const wind = best.day.windType ? `${best.day.windType} wind` : null;
    const parts = [`${waveText(best.day.surfMinFt, best.day.surfMaxFt)}`, best.day.label, wind].filter(Boolean);
    const more = candidates.length - 1;
    planned.push({
      id: ALERT_ID_BASE + index,
      at,
      title: `Surf tomorrow: ${best.spot.name}`,
      body: more > 0 ? `${parts.join(" · ")}. Plus ${more} more of your spots.` : parts.join(" · "),
    });
  }
  return planned;
}
