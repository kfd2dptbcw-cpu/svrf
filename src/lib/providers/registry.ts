import { env, type DataSource } from "@/lib/env";
import { AdmiraltyTideProvider } from "./admiralty";
import { FallbackMarineProvider, FallbackWeatherProvider } from "./fallback";
import { ModelledTideProvider, OpenMeteoMarineProvider, OpenMeteoWeatherProvider } from "./open-meteo";
import { SampleMarineProvider, SampleTideProvider, SampleWeatherProvider } from "./sample";
import type { MarineProvider, TideProvider, WeatherProvider } from "./types";
import { XweatherMarineProvider, XweatherWeatherProvider } from "./xweather";

export interface ProviderSet {
  marine: MarineProvider;
  weather: WeatherProvider;
  tide: TideProvider;
  isSample: boolean;
}

function providersFor(source: Exclude<DataSource, "sample">): { marine: MarineProvider; weather: WeatherProvider } {
  switch (source) {
    case "xweather":
      return { marine: new XweatherMarineProvider(), weather: new XweatherWeatherProvider() };
    case "open-meteo":
      return { marine: new OpenMeteoMarineProvider(), weather: new OpenMeteoWeatherProvider() };
  }
}

/**
 * Select data providers from the environment:
 *   FORECAST_DATA_SOURCE   primary source (xweather | open-meteo | sample)
 *   FALLBACK_DATA_SOURCE   optional secondary source for spots/requests the primary can't serve
 *
 * To add a new source, implement the interfaces in lib/providers/types.ts and
 * add a case to providersFor().
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

  let { marine, weather } = providersFor(env.dataSource);
  const fallback = env.fallbackDataSource;
  if (fallback && fallback !== env.dataSource) {
    const secondary = providersFor(fallback);
    marine = new FallbackMarineProvider(marine, secondary.marine);
    weather = new FallbackWeatherProvider(weather, secondary.weather);
  }

  return {
    marine,
    weather,
    tide: env.tideProvider === "admiralty" ? new AdmiraltyTideProvider() : new ModelledTideProvider(),
    isSample: false,
  };
}
