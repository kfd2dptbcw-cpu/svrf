import type { TideEvent } from "@/types/forecast";

/**
 * Data provider contracts.
 *
 * Every external data source is wrapped in a provider that returns normalised
 * hourly series keyed by spot slug. The forecast engine only ever sees these
 * shapes, so swapping Open-Meteo for another source (Stormglass, Met Office
 * DataHub, a self-hosted WaveWatch III pipeline, …) means writing one new
 * provider and registering it in registry.ts — nothing else changes.
 *
 * Units: metres, seconds, degrees true (direction waves/wind come FROM),
 * km/h, °C, unix seconds (UTC).
 */

export type Series = (number | null)[];

export interface ForecastPoint {
  slug: string;
  lat: number;
  lon: number;
}

export interface MarineSeries {
  time: number[];
  waveHeight: Series;
  waveDirection: Series;
  wavePeriod: Series;
  swellHeight: Series;
  swellDirection: Series;
  swellPeriod: Series;
  secondarySwellHeight: Series;
  secondarySwellDirection: Series;
  secondarySwellPeriod: Series;
  windWaveHeight: Series;
  seaSurfaceTemperature: Series;
  /** Sea level relative to mean sea level, including tides (if supplied). */
  seaLevel: Series;
  /** Human-readable model name, e.g. "Open-Meteo Marine (best match)". */
  source: string;
}

export interface WeatherSeries {
  time: number[];
  temperature: Series;
  windSpeed: Series;
  windGusts: Series;
  windDirection: Series;
  weatherCode: Series;
  daily: {
    /** Unix seconds of each day's sunrise / sunset. */
    sunrise: number[];
    sunset: number[];
  };
  source: string;
}

export interface TideSeries {
  time: number[];
  height: Series;
  /** Official high/low water events when the provider publishes them. */
  events: TideEvent[] | null;
  source: string;
}

export interface ProviderContext {
  /** Number of forecast days requested (including today). */
  days: number;
  signal?: AbortSignal;
}

export interface MarineProvider {
  readonly id: string;
  fetchMarine(points: ForecastPoint[], context: ProviderContext): Promise<Record<string, MarineSeries>>;
}

export interface WeatherProvider {
  readonly id: string;
  fetchWeather(points: ForecastPoint[], context: ProviderContext): Promise<Record<string, WeatherSeries>>;
}

export interface TideProvider {
  readonly id: string;
  fetchTides(
    points: (ForecastPoint & { stationId?: string })[],
    context: ProviderContext & { marine: Record<string, MarineSeries> },
  ): Promise<Record<string, TideSeries>>;
}
