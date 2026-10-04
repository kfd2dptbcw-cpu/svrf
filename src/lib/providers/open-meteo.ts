import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http/fetch-json";
import { UK_TIMEZONE } from "@/lib/time";
import type {
  ForecastPoint,
  MarineProvider,
  MarineSeries,
  ProviderContext,
  Series,
  TideProvider,
  TideSeries,
  WeatherProvider,
  WeatherSeries,
} from "./types";

/**
 * Open-Meteo (https://open-meteo.com) — free, no API key, CC BY 4.0.
 *
 * Marine data blends Météo-France MFWAM, ECMWF WAM and NOAA's GFS-Wave
 * (WaveWatch III). Weather uses the UK Met Office UKV/global models
 * (`ukmo_seamless`) with Open-Meteo's best-match blend as a fallback.
 *
 * To keep request counts tiny, every spot is fetched in a single multi-location
 * request per API (Open-Meteo accepts comma-separated coordinates), so a full
 * refresh of all spots costs two or three HTTP requests.
 */

const MAX_LOCATIONS_PER_REQUEST = 50;

const MARINE_VARIABLES = [
  "wave_height",
  "wave_direction",
  "wave_period",
  "swell_wave_height",
  "swell_wave_direction",
  "swell_wave_period",
  "secondary_swell_wave_height",
  "secondary_swell_wave_direction",
  "secondary_swell_wave_period",
  "wind_wave_height",
  "sea_surface_temperature",
  "sea_level_height_msl",
] as const;

const WEATHER_VARIABLES = [
  "temperature_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "weather_code",
] as const;

interface OpenMeteoLocationResponse {
  hourly?: { time?: number[] } & Record<string, Series | number[] | undefined>;
  daily?: { time?: number[]; sunrise?: number[]; sunset?: number[] };
}

const MODEL_LABELS: Record<string, string> = {
  best_match: "best match",
  ncep_gfswave025: "NOAA GFS-Wave / WaveWatch III",
  meteofrance_wave: "Météo-France MFWAM",
  ecmwf_wam025: "ECMWF WAM",
  ukmo_seamless: "UK Met Office",
};

function buildUrl(base: string, points: ForecastPoint[], params: Record<string, string>): string {
  const url = new URL(base);
  url.searchParams.set("latitude", points.map((point) => point.lat.toFixed(4)).join(","));
  url.searchParams.set("longitude", points.map((point) => point.lon.toFixed(4)).join(","));
  url.searchParams.set("timezone", UK_TIMEZONE);
  url.searchParams.set("timeformat", "unixtime");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  if (env.openMeteoApiKey) url.searchParams.set("apikey", env.openMeteoApiKey);
  return url.toString();
}

/** Fetch many locations, chunked, always returning one response per point in order. */
async function fetchLocations(
  base: string,
  points: ForecastPoint[],
  params: Record<string, string>,
  context: ProviderContext,
  label: string,
): Promise<OpenMeteoLocationResponse[]> {
  const results: OpenMeteoLocationResponse[] = [];
  for (let i = 0; i < points.length; i += MAX_LOCATIONS_PER_REQUEST) {
    const chunk = points.slice(i, i + MAX_LOCATIONS_PER_REQUEST);
    const data = await fetchJson<OpenMeteoLocationResponse | OpenMeteoLocationResponse[]>(
      buildUrl(base, chunk, params),
      { label, signal: context.signal },
    );
    const list = Array.isArray(data) ? data : [data];
    if (list.length !== chunk.length) {
      throw new Error(`${label} returned ${list.length} locations, expected ${chunk.length}`);
    }
    results.push(...list);
  }
  return results;
}

function hourlySeries(response: OpenMeteoLocationResponse, key: string, length: number): Series {
  const series = response.hourly?.[key];
  if (!Array.isArray(series)) return new Array<number | null>(length).fill(null);
  return series.map((value) => (typeof value === "number" && Number.isFinite(value) ? value : null));
}

/** Fraction of non-null values — used to decide whether to try a fallback model. */
function coverage(series: Series): number {
  if (series.length === 0) return 0;
  return series.filter((value) => value !== null).length / series.length;
}

/**
 * Run `fetchFor` with each model in turn, re-requesting only the points the
 * previous model left without usable data (e.g. a coastal grid cell masked as
 * land in the high-resolution model).
 */
async function withModelFallback<T>(
  points: ForecastPoint[],
  models: string[],
  fetchFor: (points: ForecastPoint[], model: string) => Promise<Record<string, T>>,
  isUsable: (value: T) => boolean,
): Promise<Record<string, T>> {
  const results: Record<string, T> = {};
  let remaining = points;
  let firstError: unknown = null;
  for (const model of models) {
    if (remaining.length === 0) break;
    try {
      const batch = await fetchFor(remaining, model);
      for (const point of remaining) {
        const value = batch[point.slug];
        if (value !== undefined && (isUsable(value) || results[point.slug] === undefined)) results[point.slug] = value;
      }
      remaining = remaining.filter((point) => {
        const value = results[point.slug];
        return value === undefined || !isUsable(value);
      });
    } catch (error) {
      firstError ??= error;
    }
  }
  if (Object.keys(results).length === 0 && firstError) throw firstError;
  return results;
}

export class OpenMeteoMarineProvider implements MarineProvider {
  readonly id = "open-meteo-marine";

  async fetchMarine(points: ForecastPoint[], context: ProviderContext): Promise<Record<string, MarineSeries>> {
    return withModelFallback(
      points,
      env.marineModels,
      (subset, model) => this.fetchModel(subset, model, context),
      (series) => coverage(series.swellHeight) > 0.5 || coverage(series.waveHeight) > 0.5,
    );
  }

  private async fetchModel(points: ForecastPoint[], model: string, context: ProviderContext) {
    const responses = await fetchLocations(
      env.openMeteoMarineUrl,
      points,
      {
        hourly: MARINE_VARIABLES.join(","),
        forecast_days: String(context.days),
        cell_selection: "sea",
        models: model,
      },
      context,
      "Open-Meteo Marine",
    );

    const result: Record<string, MarineSeries> = {};
    responses.forEach((response, index) => {
      const point = points[index]!;
      const time = response.hourly?.time ?? [];
      const n = time.length;
      result[point.slug] = {
        time,
        waveHeight: hourlySeries(response, "wave_height", n),
        waveDirection: hourlySeries(response, "wave_direction", n),
        wavePeriod: hourlySeries(response, "wave_period", n),
        swellHeight: hourlySeries(response, "swell_wave_height", n),
        swellDirection: hourlySeries(response, "swell_wave_direction", n),
        swellPeriod: hourlySeries(response, "swell_wave_period", n),
        secondarySwellHeight: hourlySeries(response, "secondary_swell_wave_height", n),
        secondarySwellDirection: hourlySeries(response, "secondary_swell_wave_direction", n),
        secondarySwellPeriod: hourlySeries(response, "secondary_swell_wave_period", n),
        windWaveHeight: hourlySeries(response, "wind_wave_height", n),
        seaSurfaceTemperature: hourlySeries(response, "sea_surface_temperature", n),
        seaLevel: hourlySeries(response, "sea_level_height_msl", n),
        source: `Open-Meteo Marine (${MODEL_LABELS[model] ?? model})`,
      };
    });
    return result;
  }
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly id = "open-meteo-weather";

  constructor(private readonly models: string[] = ["ukmo_seamless", "best_match"]) {}

  async fetchWeather(points: ForecastPoint[], context: ProviderContext): Promise<Record<string, WeatherSeries>> {
    return withModelFallback(
      points,
      this.models,
      (subset, model) => this.fetchModel(subset, model, context),
      (series) => coverage(series.windSpeed) > 0.9 && coverage(series.windDirection) > 0.9,
    );
  }

  private async fetchModel(points: ForecastPoint[], model: string, context: ProviderContext) {
    const responses = await fetchLocations(
      env.openMeteoWeatherUrl,
      points,
      {
        hourly: WEATHER_VARIABLES.join(","),
        daily: "sunrise,sunset",
        forecast_days: String(context.days),
        wind_speed_unit: "kmh",
        models: model,
      },
      context,
      "Open-Meteo Weather",
    );

    const result: Record<string, WeatherSeries> = {};
    responses.forEach((response, index) => {
      const point = points[index]!;
      const time = response.hourly?.time ?? [];
      const n = time.length;
      result[point.slug] = {
        time,
        temperature: hourlySeries(response, "temperature_2m", n),
        windSpeed: hourlySeries(response, "wind_speed_10m", n),
        windGusts: hourlySeries(response, "wind_gusts_10m", n),
        windDirection: hourlySeries(response, "wind_direction_10m", n),
        weatherCode: hourlySeries(response, "weather_code", n),
        daily: {
          sunrise: response.daily?.sunrise ?? [],
          sunset: response.daily?.sunset ?? [],
        },
        source: `Open-Meteo Weather (${MODEL_LABELS[model] ?? model})`,
      };
    });
    return result;
  }
}

/**
 * Tides from the marine model's sea level series (astronomical tide plus
 * surge). It needs no extra request, but it is a model value at the offshore
 * forecast point rather than an official port prediction — accurate enough to
 * say "around mid tide on the push", not for navigation.
 */
export class OpenMeteoTideProvider implements TideProvider {
  readonly id = "open-meteo-tide";

  async fetchTides(
    points: ForecastPoint[],
    context: ProviderContext & { marine: Record<string, MarineSeries> },
  ): Promise<Record<string, TideSeries>> {
    const result: Record<string, TideSeries> = {};
    for (const point of points) {
      const marine = context.marine[point.slug];
      if (!marine || coverage(marine.seaLevel) < 0.5) continue;
      result[point.slug] = {
        time: marine.time,
        height: marine.seaLevel,
        events: null,
        source: "Open-Meteo sea level (modelled tide)",
      };
    }
    return result;
  }
}
