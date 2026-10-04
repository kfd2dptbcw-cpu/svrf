import type { SkillLevel, TidePhase } from "@/types/forecast";

/**
 * The subset of spot configuration the engine needs, already normalised to
 * numbers. Keeping the engine independent of the config file format means the
 * config can evolve (or come from a database) without touching the algorithm.
 */
export interface EngineSpot {
  orientation: number;
  offshoreDirection: number;
  swellWindow: readonly [number, number];
  optimalSwell: number;
  minPeriod: number;
  idealTide: readonly TidePhase[];
  tideSensitivity: number;
  waveRangeFt: readonly [number, number];
  sizeFactor: number;
  skillLevels: readonly SkillLevel[];
  breakType: "beach" | "reef" | "point" | "rivermouth";
}
