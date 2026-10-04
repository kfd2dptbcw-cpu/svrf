import { angularDifference } from "@/lib/forecast/engine/angles";

/**
 * Matching surf spots to ADMIRALTY tidal stations (UK Tidal API `/Stations`).
 * Pure functions so the matching can be unit tested without the API.
 */

export interface TideStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface StationMatch {
  slug: string;
  station: TideStation;
  distanceKm: number;
  /** Bearing from the spot to the station, degrees true. */
  bearing: number;
  flags: string[];
}

/** Distance beyond which a station's tide times may differ noticeably from the beach's. */
export const MAX_STATION_DISTANCE_KM = 15;

/**
 * Normalise the `/Stations` response. The API returns a GeoJSON
 * FeatureCollection (`features[].properties.Id/Name`, `geometry.coordinates`
 * as [lon, lat]); a plain array of the same objects is accepted too.
 */
export function parseStations(body: unknown): TideStation[] {
  const features = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { features?: unknown }).features)
      ? (body as { features: unknown[] }).features
      : [];
  const stations: TideStation[] = [];
  for (const feature of features) {
    const f = feature as {
      properties?: { Id?: unknown; Name?: unknown };
      geometry?: { coordinates?: unknown };
    };
    const coords = f.geometry?.coordinates;
    const id = f.properties?.Id;
    if (!Array.isArray(coords) || typeof coords[0] !== "number" || typeof coords[1] !== "number" || typeof id !== "string") continue;
    stations.push({ id, name: String(f.properties?.Name ?? id), lon: coords[0], lat: coords[1] });
  }
  return stations;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function initialBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * toRad) * Math.cos(lat2 * toRad);
  const x =
    Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
    Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos((lon2 - lon1) * toRad);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Nearest station to a spot, with review flags:
 *  - more than MAX_STATION_DISTANCE_KM away;
 *  - "possibly across a headland / on another coast": the station lies more
 *    than 100° away from the direction the beach faces and over 5 km away,
 *    i.e. behind the beach rather than along the same stretch of coast. This
 *    is a heuristic — there is no coastline data here — so flagged spots need
 *    a human look at a map.
 */
export function nearestStation(
  spot: { slug: string; lat: number; lon: number; orientation: number },
  stations: readonly TideStation[],
): StationMatch | null {
  let best: StationMatch | null = null;
  for (const station of stations) {
    const distanceKm = haversineKm(spot.lat, spot.lon, station.lat, station.lon);
    if (!best || distanceKm < best.distanceKm) {
      best = { slug: spot.slug, station, distanceKm, bearing: initialBearing(spot.lat, spot.lon, station.lat, station.lon), flags: [] };
    }
  }
  if (!best) return null;
  if (best.distanceKm > MAX_STATION_DISTANCE_KM) best.flags.push(`${best.distanceKm.toFixed(1)} km away`);
  if (best.distanceKm > 5 && angularDifference(best.bearing, spot.orientation) > 100) {
    best.flags.push("possibly across a headland / on another stretch of coast");
  }
  return best;
}
