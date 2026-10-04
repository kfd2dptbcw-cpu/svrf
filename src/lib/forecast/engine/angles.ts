import { COMPASS_POINTS, type CompassPoint } from "@/types/forecast";

/** Normalise any angle into the range [0, 360). */
export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Smallest absolute difference between two bearings, 0–180°. */
export function angularDifference(a: number, b: number): number {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return diff > 180 ? 360 - diff : diff;
}

export function compassToDegrees(point: CompassPoint): number {
  return COMPASS_POINTS.indexOf(point) * 22.5;
}

export function degreesToCompass(degrees: number): CompassPoint {
  const index = Math.round(normalizeDegrees(degrees) / 22.5) % 16;
  return COMPASS_POINTS[index] ?? "N";
}

/** Circular (vector) mean of a set of bearings. */
export function circularMean(bearings: readonly number[]): number {
  if (bearings.length === 0) throw new Error("circularMean requires at least one bearing");
  let x = 0;
  let y = 0;
  for (const bearing of bearings) {
    const rad = (bearing * Math.PI) / 180;
    x += Math.cos(rad);
    y += Math.sin(rad);
  }
  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

/** Clockwise angular width of an arc from `from` to `to`. */
export function arcWidth(from: number, to: number): number {
  const width = normalizeDegrees(to - from);
  return width === 0 ? 360 : width;
}

/** True when `bearing` lies on the clockwise arc from `from` to `to` (inclusive). */
export function isWithinArc(bearing: number, from: number, to: number): boolean {
  return normalizeDegrees(bearing - from) <= arcWidth(from, to);
}

/** How far outside a clockwise arc a bearing lies, in degrees (0 when inside). */
export function distanceOutsideArc(bearing: number, from: number, to: number): number {
  if (isWithinArc(bearing, from, to)) return 0;
  return Math.min(angularDifference(bearing, from), angularDifference(bearing, to));
}

/**
 * Point reached by travelling `distanceKm` from a start point on a given
 * bearing (great-circle). Used to place marine forecast points offshore.
 */
export function destinationPoint(lat: number, lon: number, bearing: number, distanceKm: number) {
  const R = 6371;
  const δ = distanceKm / R;
  const θ = (bearing * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return {
    lat: Math.round(((φ2 * 180) / Math.PI) * 10000) / 10000,
    lon: Math.round(((λ2 * 180) / Math.PI) * 10000) / 10000,
  };
}

const DIRECTION_ADJECTIVES: Record<string, string> = {
  N: "northerly",
  NE: "north-easterly",
  E: "easterly",
  SE: "south-easterly",
  S: "southerly",
  SW: "south-westerly",
  W: "westerly",
  NW: "north-westerly",
};

/** "easterly", "south-westerly", … (8-point adjective for prose). */
export function directionAdjective(degrees: number): string {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
  const point = points[Math.round(normalizeDegrees(degrees) / 45) % 8] ?? "N";
  return DIRECTION_ADJECTIVES[point] ?? "variable";
}
