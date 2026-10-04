import type { ResolvedSpot } from "@/lib/config";
import type { EngineSpot } from "./types";
import { idealOffshoreDirection } from "./wind";

export { buildSpotForecast, type SpotRawData } from "./build";
export type { EngineSpot } from "./types";

/** Adapt a configured spot into the normalised shape the engine works with. */
export function toEngineSpot(spot: ResolvedSpot): EngineSpot {
  return {
    orientation: spot.orientation,
    offshoreDirection: idealOffshoreDirection(spot.orientation, spot.wind.preferred),
    swellWindow: spot.swell.window,
    optimalSwell: spot.swell.optimal,
    minPeriod: spot.swell.minPeriod,
    idealTide: spot.tide.ideal,
    tideSensitivity: spot.tide.sensitivity,
    waveRangeFt: spot.waveRangeFt,
    sizeFactor: spot.sizeFactor,
    skillLevels: spot.skillLevels,
    breakType: spot.breakType,
  };
}
