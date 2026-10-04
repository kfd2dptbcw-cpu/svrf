import regionsJson from "@config/regions.json";
import spotsJson from "@config/spots.json";
import { destinationPoint } from "@/lib/forecast/engine/angles";
import { regionsFileSchema, spotsFileSchema, type RegionConfig, type SpotConfig } from "./schema";

export type { RegionConfig, SpotConfig } from "./schema";

export interface ResolvedSpot extends SpotConfig {
  /** Coordinates passed to the marine model. */
  marinePoint: { lat: number; lon: number };
  /** Friendly URL path, e.g. /surf/cornwall/fistral */
  path: string;
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

/**
 * Parse and cross-validate the raw JSON configuration. Exported separately
 * so the validation script and tests can run it against arbitrary input.
 */
export function parseConfig(rawRegions: unknown, rawSpots: unknown) {
  const regionsResult = regionsFileSchema.safeParse(rawRegions);
  if (!regionsResult.success) {
    throw new ConfigError(`config/regions.json is invalid:\n${formatIssues(regionsResult.error.issues)}`);
  }
  const spotsResult = spotsFileSchema.safeParse(rawSpots);
  if (!spotsResult.success) {
    throw new ConfigError(`config/spots.json is invalid:\n${formatIssues(spotsResult.error.issues)}`);
  }

  const regions = regionsResult.data.regions;
  const regionSlugs = new Set<string>();
  for (const region of regions) {
    if (regionSlugs.has(region.slug)) throw new ConfigError(`Duplicate region slug "${region.slug}"`);
    regionSlugs.add(region.slug);
  }

  const seen = new Set<string>();
  const spots: ResolvedSpot[] = [];
  for (const spot of spotsResult.data.spots) {
    if (seen.has(spot.slug)) throw new ConfigError(`Duplicate spot slug "${spot.slug}"`);
    seen.add(spot.slug);
    if (!regionSlugs.has(spot.region)) {
      throw new ConfigError(`Spot "${spot.slug}" references unknown region "${spot.region}"`);
    }
    if (!spot.enabled) continue;
    spots.push({
      ...spot,
      marinePoint:
        spot.forecastPoint ??
        destinationPoint(spot.location.lat, spot.location.lon, spot.orientation, spot.offshoreDistanceKm),
      path: `/surf/${spot.region}/${spot.slug}`,
    });
  }

  return { regions, spots };
}

function formatIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues.map((issue) => `  • ${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`).join("\n");
}

const parsed = parseConfig(regionsJson, spotsJson);

export const regions: readonly RegionConfig[] = parsed.regions;
export const spots: readonly ResolvedSpot[] = parsed.spots;

const spotsBySlug = new Map(spots.map((spot) => [spot.slug, spot]));
const regionsBySlug = new Map(regions.map((region) => [region.slug, region]));

export function getSpot(slug: string): ResolvedSpot | undefined {
  return spotsBySlug.get(slug);
}

export function getRegion(slug: string): RegionConfig | undefined {
  return regionsBySlug.get(slug);
}

export function getSpotsInRegion(regionSlug: string): ResolvedSpot[] {
  return spots.filter((spot) => spot.region === regionSlug);
}

/** Regions that contain at least one enabled spot, in configuration order. */
export function getActiveRegions(): RegionConfig[] {
  const active = new Set(spots.map((spot) => spot.region));
  return regions.filter((region) => active.has(region.slug));
}
