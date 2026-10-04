import { env } from "@/lib/env";
import { AdmiraltyTideProvider } from "./admiralty";
import { OpenMeteoMarineProvider, OpenMeteoTideProvider, OpenMeteoWeatherProvider } from "./open-meteo";
import { SampleMarineProvider, SampleTideProvider, SampleWeatherProvider } from "./sample";
import type { MarineProvider, TideProvider, WeatherProvider } from "./types";

export interface ProviderSet {
  marine: MarineProvider;
  weather: WeatherProvider;
  tide: TideProvider;
  isSample: boolean;
}

/**
 * Select data providers from the environment. To add a new source, implement
 * the relevant interface in lib/providers/types.ts and wire it in here.
 */
export function getProviders(): ProviderSet {
  if (env.dataSource === "sample") {
    return {
      marine: new SampleMarineProvider(),
      weather: new SampleWeatherProvider(),
      tide: new SampleTideProvider(),
      isSample: true,
    };
  }
  return {
    marine: new OpenMeteoMarineProvider(),
    weather: new OpenMeteoWeatherProvider(),
    tide: env.tideProvider === "admiralty" ? new AdmiraltyTideProvider() : new OpenMeteoTideProvider(),
    isSample: false,
  };
}
