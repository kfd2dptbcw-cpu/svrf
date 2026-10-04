import { ukTimeParts } from "@/lib/time";
import type {
  ForecastPoint,
  MarineProvider,
  MarineSeries,
  ProviderContext,
  TideProvider,
  TideSeries,
  WeatherProvider,
  WeatherSeries,
} from "./types";

/**
 * SAMPLE DATA — NOT A REAL FORECAST.
 *
 * Deterministic synthetic series used when FORECAST_DATA_SOURCE=sample, for
 * offline development, UI work and demos where the real APIs are unreachable.
 * The UI shows a prominent "Sample data" banner whenever these providers are
 * active. Never enable in production.
 */

const SAMPLE_LABEL = "Sample data (synthetic — not a real forecast)";

/** Small deterministic PRNG so every spot gets stable but different values. */
function seeded(seedText: string) {
  let seed = 0;
  for (const char of seedText) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function timeline(days: number): number[] {
  const now = Math.floor(Date.now() / 3_600_000) * 3600;
  const start = now - ukTimeParts(now).hour * 3600;
  return Array.from({ length: days * 24 }, (_, i) => start + i * 3600);
}

/** North Sea spots see swell from the north-east; everything else from the Atlantic. */
function swellBase(point: ForecastPoint) {
  return point.lon > -2.6 && point.lat > 54.5 ? 30 : point.lon > -2.6 && point.lat > 53.8 ? 40 : 270;
}

export class SampleMarineProvider implements MarineProvider {
  readonly id = "sample-marine";

  async fetchMarine(points: ForecastPoint[], context: ProviderContext): Promise<Record<string, MarineSeries>> {
    const time = timeline(context.days);
    const result: Record<string, MarineSeries> = {};
    for (const point of points) {
      const random = seeded(point.slug);
      const phase = random() * Math.PI * 2;
      const scale = 0.6 + random() * 0.8;
      const base = swellBase(point);
      const swellHeight = time.map((_, i) => round(Math.max(0.2, scale * (1.2 + Math.sin(i / 30 + phase)))));
      const swellPeriod = time.map((_, i) => round(9 + 4 * Math.sin(i / 40 + phase / 2)));
      const swellDirection = time.map((_, i) => round(base + 25 * Math.sin(i / 50 + phase)));
      const windWave = time.map((_, i) => round(0.3 + 0.3 * Math.abs(Math.sin(i / 12 + phase))));
      const seaLevel = time.map((t) => {
        const hours = t / 3600;
        const springNeap = 1 + 0.35 * Math.cos((2 * Math.PI * hours) / 354.4 + phase);
        return round(2.2 * springNeap * Math.cos((2 * Math.PI * hours) / 12.42 + phase));
      });
      result[point.slug] = {
        time,
        waveHeight: swellHeight.map((h, i) => round(Math.hypot(h ?? 0, windWave[i] ?? 0))),
        waveDirection: swellDirection,
        wavePeriod: swellPeriod.map((p) => round((p ?? 8) - 1)),
        swellHeight,
        swellDirection,
        swellPeriod,
        secondarySwellHeight: time.map(() => null),
        secondarySwellDirection: time.map(() => null),
        secondarySwellPeriod: time.map(() => null),
        windWaveHeight: windWave,
        seaSurfaceTemperature: time.map(() => round(13 + random() * 0.4)),
        seaLevel,
        source: SAMPLE_LABEL,
      };
    }
    return result;
  }
}

export class SampleWeatherProvider implements WeatherProvider {
  readonly id = "sample-weather";

  async fetchWeather(points: ForecastPoint[], context: ProviderContext): Promise<Record<string, WeatherSeries>> {
    const time = timeline(context.days);
    const result: Record<string, WeatherSeries> = {};
    for (const point of points) {
      const random = seeded(`${point.slug}:wind`);
      const phase = random() * Math.PI * 2;
      const windSpeed = time.map((t, i) => {
        const { hour } = ukTimeParts(t);
        const seaBreeze = hour >= 12 && hour <= 17 ? 8 : 0;
        return round(Math.max(2, 14 + 10 * Math.sin(i / 18 + phase) + seaBreeze));
      });
      const days = Array.from({ length: context.days }, (_, d) => (time[0] ?? 0) + d * 86400);
      result[point.slug] = {
        time,
        temperature: time.map((t) => {
          const { hour } = ukTimeParts(t);
          return round(12 + 4 * Math.sin(((hour - 9) / 24) * 2 * Math.PI));
        }),
        windSpeed,
        windGusts: windSpeed.map((speed) => round((speed ?? 0) * 1.4)),
        windDirection: time.map((_, i) => round((200 + 150 * Math.sin(i / 36 + phase) + 360) % 360)),
        weatherCode: time.map((_, i) => [0, 1, 2, 3, 61][Math.floor(Math.abs(Math.sin(i / 20 + phase)) * 5)] ?? 2),
        daily: {
          sunrise: days.map((day) => day + 7 * 3600),
          sunset: days.map((day) => day + 19 * 3600),
        },
        source: SAMPLE_LABEL,
      };
    }
    return result;
  }
}

export class SampleTideProvider implements TideProvider {
  readonly id = "sample-tide";

  async fetchTides(
    points: ForecastPoint[],
    context: ProviderContext & { marine: Record<string, MarineSeries> },
  ): Promise<Record<string, TideSeries>> {
    const result: Record<string, TideSeries> = {};
    for (const point of points) {
      const marine = context.marine[point.slug];
      if (marine) result[point.slug] = { time: marine.time, height: marine.seaLevel, events: null, source: SAMPLE_LABEL };
    }
    return result;
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
