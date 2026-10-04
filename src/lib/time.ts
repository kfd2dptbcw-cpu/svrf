/**
 * Time helpers. All forecast timestamps are unix seconds (UTC); everything a
 * surfer sees is in UK local time (Europe/London), independent of the server
 * or browser timezone so server and client render identically.
 */

export const UK_TIMEZONE = "Europe/London";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: UK_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Local UK calendar date (YYYY-MM-DD) for a unix timestamp in seconds. */
export function ukDateKey(unixSeconds: number): string {
  return dateKeyFormatter.format(new Date(unixSeconds * 1000));
}

/** Local UK hour and minute for a unix timestamp in seconds. */
export function ukTimeParts(unixSeconds: number): { hour: number; minute: number } {
  const parts = hourFormatter.formatToParts(new Date(unixSeconds * 1000));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return { hour, minute };
}

/** Add whole days to a YYYY-MM-DD key (calendar arithmetic, DST safe). */
export function addDaysToKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
