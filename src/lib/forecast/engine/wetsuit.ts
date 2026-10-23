/**
 * Wetsuit picker: a pure rules table, no I/O and no AI.
 *
 * Thresholds follow the SVRF blog guidance (UK sea temperature by month and
 * "What to wear surfing in winter"): 4/3 through Sept-Oct water (14-16°C),
 * 5/4 from November (13 falling to 10°C) with boots, and full winter kit
 * (5/4, 5mm boots, 3mm gloves, hood) once the sea is around 9°C or below.
 * The warm end (3/2 and shortie) is an addition for summer water.
 *
 * Wind chill moves the pick one step colder: offshore or strong wind on cold
 * air strips heat from wet skin, so the sea temperature alone understates it.
 */

export interface WetsuitInput {
  seaTempC: number | null;
  airTempC: number | null;
  windSpeedKmh: number | null;
}

export type SuitThickness = "shorty" | "3/2mm" | "4/3mm" | "5/4mm";

export interface WetsuitPick {
  suit: SuitThickness;
  boots: "none" | "optional" | "3mm" | "5mm";
  gloves: "none" | "optional" | "3mm";
  hood: boolean;
  /** True when wind chill pushed the pick one step colder. */
  windChillBump: boolean;
  /** Effective temperature used for the pick, after wind chill. */
  effectiveTempC: number;
  /** One-line summary, e.g. "5/4mm, boots, gloves & hood". */
  headline: string;
  /** Short plain-English reasons, shown under the headline. */
  notes: string[];
}

/** Wind chill only matters when the air is cold and the wind is up. */
const CHILL_AIR_MAX_C = 12;
const CHILL_WIND_MIN_KMH = 25;
/** How much colder it effectively feels for the pick, in °C of sea temp. */
const CHILL_PENALTY_C = 1.5;

export function pickWetsuit(input: WetsuitInput): WetsuitPick | null {
  const { seaTempC, airTempC, windSpeedKmh } = input;
  if (seaTempC === null || !Number.isFinite(seaTempC)) return null;

  const chill =
    airTempC !== null &&
    windSpeedKmh !== null &&
    airTempC < CHILL_AIR_MAX_C &&
    windSpeedKmh >= CHILL_WIND_MIN_KMH;
  const effective = chill ? seaTempC - CHILL_PENALTY_C : seaTempC;

  let suit: SuitThickness;
  let boots: WetsuitPick["boots"];
  let gloves: WetsuitPick["gloves"];
  let hood: boolean;

  if (effective >= 18) {
    suit = "shorty";
    boots = "none";
    gloves = "none";
    hood = false;
  } else if (effective >= 16) {
    suit = "3/2mm";
    boots = "none";
    gloves = "none";
    hood = false;
  } else if (effective >= 14) {
    suit = "4/3mm";
    boots = "optional";
    gloves = "none";
    hood = false;
  } else if (effective >= 11) {
    suit = "5/4mm";
    boots = "3mm";
    gloves = "optional";
    hood = false;
  } else if (effective >= 9.5) {
    suit = "5/4mm";
    boots = "5mm";
    gloves = "3mm";
    hood = false;
  } else {
    suit = "5/4mm";
    boots = "5mm";
    gloves = "3mm";
    hood = true;
  }

  const parts: string[] = [suit === "shorty" ? "Shorty or 3/2mm" : `${suit} wetsuit`];
  if (boots === "3mm" || boots === "5mm") parts.push("boots");
  if (gloves === "3mm") parts.push("gloves");
  if (hood) parts.push("hood");

  const notes: string[] = [];
  if (boots === "optional") notes.push("Boots are welcome for the walk across the sand.");
  if (gloves === "optional") notes.push("Gloves once your hands stop working on the paddle out.");
  if (chill) notes.push("Wind on cold air will feel colder than the sea temperature suggests, so kit is one step warmer.");
  if (suit !== "shorty") notes.push("Fit beats thickness: a well-fitted 4/3 is warmer than a baggy 5/4.");

  const headline = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} & ${parts[parts.length - 1]}`;

  return {
    suit,
    boots,
    gloves,
    hood,
    windChillBump: chill,
    effectiveTempC: effective,
    headline,
    notes,
  };
}

/** Dry-kit items for the car park afterwards. Slugs are svrf.uk product handles. */
export interface AfterSessionItem {
  slug: string;
  label: string;
  why: string;
}

export function afterSessionKit(pick: WetsuitPick): AfterSessionItem[] {
  const cold = pick.effectiveTempC < 14;
  const items: AfterSessionItem[] = [
    { slug: "changing-mat-towel", label: "Changing mat towel", why: "Something to stand on that isn't the car park." },
  ];
  if (cold) {
    items.push(
      { slug: "fisherman-beanie", label: "Fisherman beanie", why: "On before anything else goes on." },
      { slug: "svrf-core-hood", label: "Core Hood", why: "A heavy layer you can pull over wet hair." },
    );
  }
  return items;
}
