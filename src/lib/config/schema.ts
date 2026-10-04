import { z } from "zod";
import { COMPASS_POINTS, SKILL_LEVELS, TIDE_PHASES } from "@/types/forecast";
import { compassToDegrees } from "@/lib/forecast/engine/angles";

/**
 * Schema for the editable JSON configuration in /config.
 *
 * Directions can be written either as compass points ("WNW") or as degrees
 * true (292.5). They are normalised to degrees during parsing so the engine
 * only ever deals with numbers.
 */

const direction = z
  .union([z.enum(COMPASS_POINTS), z.number().min(0).max(360)])
  .transform((value) => (typeof value === "number" ? value % 360 : compassToDegrees(value)));

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slugs must be lowercase words separated by hyphens");

const coordinates = z.object({
  lat: z.number().min(49).max(61, "Latitude must be within the UK (49–61°N)"),
  lon: z.number().min(-9).max(2.5, "Longitude must be within the UK (-9–2.5°E)"),
});

export const regionSchema = z.object({
  slug,
  name: z.string().min(1),
  country: z.string().min(1),
  description: z.string().min(1),
});

export const regionsFileSchema = z.object({
  $schema: z.string().optional(),
  regions: z.array(regionSchema).min(1),
});

export const spotSchema = z.object({
  slug,
  name: z.string().min(1),
  region: slug,
  location: coordinates,
  /**
   * Optional point used for the marine model. Defaults to a point
   * `offshoreDistanceKm` out to sea along the beach orientation, which keeps
   * the model grid cell off the land mask.
   */
  forecastPoint: coordinates.optional(),
  offshoreDistanceKm: z.number().min(0).max(30).default(6),
  /** Direction the beach faces, i.e. looking out to sea (degrees true). */
  orientation: direction,
  breakType: z.enum(["beach", "reef", "point", "rivermouth"]),
  skillLevels: z.array(z.enum(SKILL_LEVELS)).min(1),
  swell: z.object({
    /** Swell arriving between these directions (clockwise) reaches the spot. */
    window: z.tuple([direction, direction]),
    /** Swell direction that produces the best waves. */
    optimal: direction,
    /** Periods below this produce weak, disorganised waves at this spot. */
    minPeriod: z.number().min(3).max(20).default(8),
  }),
  wind: z.object({
    /** Wind directions (where the wind blows from) that groom the waves. */
    preferred: z.array(direction).min(1),
  }),
  tide: z.object({
    ideal: z.array(z.enum(TIDE_PHASES)).min(1),
    /** 0 = works on any tide, 1 = only works on the ideal tide. */
    sensitivity: z.number().min(0).max(1).default(0.3),
  }),
  /** Typical surfable range in feet [min, max] (face height). */
  waveRangeFt: z
    .tuple([z.number().min(0), z.number().min(1)])
    .refine(([min, max]) => max > min, "waveRangeFt max must be greater than min"),
  /** Local calibration multiplier for wave size (exposure, shoaling, shadowing). */
  sizeFactor: z.number().min(0.1).max(2).default(1),
  description: z.string().min(1),
  hazards: z.array(z.string()).default([]),
  /** UK Hydrographic Office station ID, used when TIDE_PROVIDER=admiralty. */
  tideStationId: z.string().optional(),
  enabled: z.boolean().default(true),
});

export const spotsFileSchema = z.object({
  $schema: z.string().optional(),
  spots: z.array(spotSchema).min(1),
});

export type RegionConfig = z.output<typeof regionSchema>;
export type SpotConfig = z.output<typeof spotSchema>;
export type SpotConfigInput = z.input<typeof spotSchema>;
