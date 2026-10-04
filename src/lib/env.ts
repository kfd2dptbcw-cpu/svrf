/**
 * Centralised, typed access to environment variables with safe defaults.
 * See .env.example for documentation of every variable.
 */

function str(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? fallback : value.trim();
}

function int(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(name: string, fallback: string[]): string[] {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  get siteUrl() {
    return str("NEXT_PUBLIC_SITE_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get siteName() {
    return str("NEXT_PUBLIC_SITE_NAME", "UK Surf Forecast");
  },
  get cronSecret() {
    return process.env.CRON_SECRET?.trim() || null;
  },
  /** UTC hours at which a fresh forecast becomes due. */
  get refreshHoursUtc(): number[] {
    const hours = list("REFRESH_HOURS_UTC", ["6", "18"])
      .map(Number)
      .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour < 24);
    return hours.length > 0 ? [...new Set(hours)].sort((a, b) => a - b) : [6, 18];
  },
  get forecastDays() {
    return Math.min(Math.max(int("FORECAST_DAYS", 7), 1), 10);
  },
  get dataSource(): "open-meteo" | "sample" {
    return str("FORECAST_DATA_SOURCE", "open-meteo") === "sample" ? "sample" : "open-meteo";
  },
  get tideProvider(): "open-meteo" | "admiralty" {
    return str("TIDE_PROVIDER", "open-meteo") === "admiralty" ? "admiralty" : "open-meteo";
  },
  get openMeteoMarineUrl() {
    return str("OPEN_METEO_MARINE_URL", "https://marine-api.open-meteo.com/v1/marine");
  },
  get openMeteoWeatherUrl() {
    return str("OPEN_METEO_WEATHER_URL", "https://api.open-meteo.com/v1/forecast");
  },
  /** Only needed for Open-Meteo's commercial endpoints; free use needs no key. */
  get openMeteoApiKey() {
    return process.env.OPEN_METEO_API_KEY?.trim() || null;
  },
  /** Marine models tried in order for spots the previous model left without data. */
  get marineModels(): string[] {
    return list("OPEN_METEO_MARINE_MODELS", ["best_match", "ncep_gfswave025"]);
  },
  get admiraltyApiKey() {
    return process.env.ADMIRALTY_API_KEY?.trim() || null;
  },
  get httpTimeoutMs() {
    return int("HTTP_TIMEOUT_MS", 15000);
  },
  get httpRetries() {
    return Math.max(0, int("HTTP_RETRIES", 2));
  },
  get cacheDriver(): "file" | "memory" | "upstash" {
    const driver = str("CACHE_DRIVER", process.env.UPSTASH_REDIS_REST_URL ? "upstash" : "file");
    return driver === "memory" || driver === "upstash" ? driver : "file";
  },
  get cacheDir() {
    return str("CACHE_DIR", process.env.VERCEL ? "/tmp/forecast-cache" : ".forecast-cache");
  },
  get upstashUrl() {
    return process.env.UPSTASH_REDIS_REST_URL?.trim() || null;
  },
  get upstashToken() {
    return process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || null;
  },
  /** Minimum gap between failed refresh attempts, to protect upstream APIs. */
  get failureBackoffSeconds() {
    return int("REFRESH_FAILURE_BACKOFF_SECONDS", 900);
  },
};
