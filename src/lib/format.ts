import type { SuitabilityLevel, WindType } from "@/types/forecast";
import { KMH_TO_MPH, METRES_TO_FEET } from "@/lib/forecast/engine/math";
import { ukTimeParts, UK_TIMEZONE } from "@/lib/time";

/** "7am", "12pm", "1:30pm" in UK time. */
export function formatHour(unixSeconds: number): string {
  const { hour, minute } = ukTimeParts(unixSeconds);
  const suffix = hour < 12 ? "am" : "pm";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0 ? `${displayHour}${suffix}` : `${displayHour}:${String(minute).padStart(2, "0")}${suffix}`;
}

/** "07:42" in UK time. */
export function formatClock(unixSeconds: number): string {
  const { hour, minute } = ukTimeParts(unixSeconds);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatTimeRange(start: number, end: number): string {
  return `${formatHour(start)}–${formatHour(end)}`;
}

/** "3-4ft", "1ft", "Flat". */
export function formatSurfRange(minFt: number, maxFt: number): string {
  if (maxFt <= 0) return "Flat";
  if (minFt === maxFt) return `${maxFt}ft`;
  return `${minFt}-${maxFt}ft`;
}

export function metresToFeet(metres: number): number {
  return metres * METRES_TO_FEET;
}

export function formatMetres(metres: number | null | undefined, decimals = 1): string {
  return metres == null ? "–" : `${metres.toFixed(decimals)}m`;
}

export function formatFeet(metres: number | null | undefined): string {
  return metres == null ? "–" : `${(metres * METRES_TO_FEET).toFixed(1)}ft`;
}

export function kmhToMph(kmh: number): number {
  return kmh * KMH_TO_MPH;
}

export function formatMph(kmh: number | null | undefined): string {
  return kmh == null ? "–" : `${Math.round(kmh * KMH_TO_MPH)}mph`;
}

export function formatTemp(celsius: number | null | undefined): string {
  return celsius == null ? "–" : `${Math.round(celsius)}°C`;
}

export function formatPeriod(seconds: number | null | undefined): string {
  return seconds == null ? "–" : `${Math.round(seconds)}s`;
}

const dayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
const shortDayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const fullDateFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function keyToDate(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}

/** "Monday" for a YYYY-MM-DD key. */
export function formatWeekday(dateKey: string, style: "long" | "short" = "long"): string {
  return (style === "long" ? dayFormatter : shortDayFormatter).format(keyToDate(dateKey));
}

/** "Monday 6 October". */
export function formatFullDate(dateKey: string): string {
  return fullDateFormatter.format(keyToDate(dateKey));
}

/** "6 Oct". */
export function formatShortDate(dateKey: string): string {
  return shortDateFormatter.format(keyToDate(dateKey));
}

const timestampFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "Sat 4 Oct, 18:00" in UK time. */
export function formatTimestamp(unixSeconds: number): string {
  return timestampFormatter.format(new Date(unixSeconds * 1000));
}

export const WIND_TYPE_LABELS: Record<WindType, string> = {
  offshore: "Offshore",
  "cross-offshore": "Cross-offshore",
  "cross-shore": "Cross-shore",
  onshore: "Onshore",
};

export const SUITABILITY_LABELS: Record<SuitabilityLevel, string> = {
  ideal: "Ideal",
  good: "Good",
  marginal: "Marginal",
  unsuitable: "Not suitable",
};
