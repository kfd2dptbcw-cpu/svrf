import type { ForecastPoint, MarineProvider, MarineSeries, ProviderContext, WeatherProvider, WeatherSeries } from "./types";

/**
 * Wrap a primary provider with a secondary one. The secondary is asked only
 * for spots the primary couldn't supply (or for all spots if the primary
 * fails outright), keeping secondary usage — and its cost — to a minimum.
 */
async function withFallback<T>(
  points: ForecastPoint[],
  primary: (points: ForecastPoint[]) => Promise<Record<string, T>>,
  secondary: (points: ForecastPoint[]) => Promise<Record<string, T>>,
): Promise<Record<string, T>> {
  let results: Record<string, T> = {};
  let primaryError: unknown = null;
  try {
    results = await primary(points);
  } catch (error) {
    primaryError = error;
  }
  const missing = points.filter((point) => results[point.slug] === undefined);
  if (missing.length === 0) return results;
  try {
    return { ...results, ...(await secondary(missing)) };
  } catch (error) {
    if (Object.keys(results).length > 0) return results;
    throw primaryError ?? error;
  }
}

export class FallbackMarineProvider implements MarineProvider {
  readonly id: string;
  constructor(
    private readonly primary: MarineProvider,
    private readonly secondary: MarineProvider,
  ) {
    this.id = `${primary.id}+${secondary.id}`;
  }

  fetchMarine(points: ForecastPoint[], context: ProviderContext): Promise<Record<string, MarineSeries>> {
    return withFallback(
      points,
      (p) => this.primary.fetchMarine(p, context),
      (p) => this.secondary.fetchMarine(p, context),
    );
  }
}

export class FallbackWeatherProvider implements WeatherProvider {
  readonly id: string;
  constructor(
    private readonly primary: WeatherProvider,
    private readonly secondary: WeatherProvider,
  ) {
    this.id = `${primary.id}+${secondary.id}`;
  }

  fetchWeather(points: ForecastPoint[], context: ProviderContext): Promise<Record<string, WeatherSeries>> {
    return withFallback(
      points,
      (p) => this.primary.fetchWeather(p, context),
      (p) => this.secondary.fetchWeather(p, context),
    );
  }
}
