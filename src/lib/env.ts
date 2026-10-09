/**
 * Centralised, typed access to environment variables with safe defaults.
 * See .env.example for documentation of every variable.
 */

export const DATA_SOURCES = ["xweather", "open-meteo", "sample"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

function source(value: string | undefined): DataSource | null {
  const normalised = value?.trim().toLowerCase();
  return DATA_SOURCES.find((candidate) => candidate === normalised) ?? null;
}

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

/**
 * Clean a pasted secret: trim whitespace and newlines, drop a leading
 * `NAME=` (or `export NAME=`) copied from a .env file, and strip wrapping
 * single or double quotes. Repeats until stable, so `NAME="value"\n` and
 * `"NAME=value"` both become `value`.
 */
export function sanitizeEnvValue(name: string, raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const prefix = new RegExp(`^(?:export\\s+)?${name}\\s*=\\s*`, "i");
  let value = raw;
  for (let previous = ""; previous !== value; ) {
    previous = value;
    value = value.trim().replace(prefix, "");
    const quoted = /^(["'])([\s\S]*)\1$/.exec(value);
    if (quoted) value = quoted[2]!;
  }
  return value || null;
}

/** Sanitise an Upstash REST URL down to `https://host` (no path, query or trailing slash). */
export function sanitizeUpstashUrl(raw: string | undefined): string | null {
  const value = sanitizeEnvValue("UPSTASH_REDIS_REST_URL", raw);
  if (!value) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    return url.host ? `https://${url.host}` : null; // Upstash's REST API is HTTPS-only
  } catch {
    return null;
  }
}

export const env = {
  get siteUrl() {
    return str("NEXT_PUBLIC_SITE_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get siteName() {
    return str("NEXT_PUBLIC_SITE_NAME", "SVRF Surf Forecast");
  },
  get cronSecret() {
    return process.env.CRON_SECRET?.trim() || null;
  },
  /** UTC hours at which a fresh forecast becomes due. */
  get refreshHoursUtc(): number[] {
    const hours = list("REFRESH_HOURS_UTC", ["6"])
      .map(Number)
      .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour < 24);
    return hours.length > 0 ? [...new Set(hours)].sort((a, b) => a - b) : [6];
  },
  get forecastDays() {
    return Math.min(Math.max(int("FORECAST_DAYS", 7), 1), 10);
  },
  /**
   * Primary forecast data source. Defaults to Xweather when its credentials
   * are configured, otherwise Open-Meteo.
   */
  get dataSource(): DataSource {
    return source(process.env.FORECAST_DATA_SOURCE) ?? (process.env.XWEATHER_CLIENT_ID ? "xweather" : "open-meteo");
  },
  /** Optional secondary source for spots the primary can't serve ("none" disables). */
  get fallbackDataSource(): Exclude<DataSource, "sample"> | null {
    const fallback = source(process.env.FALLBACK_DATA_SOURCE);
    return fallback === "sample" ? null : fallback;
  },
  /** Skip Xweather refreshes once the period's remaining accesses fall below this. */
  get minRemainingAllowance() {
    return Math.max(0, int("XWEATHER_MIN_REMAINING", 1000));
  },
  /** Log a warning once the period's remaining accesses fall below this. */
  get warnRemainingAllowance() {
    return Math.max(0, int("XWEATHER_WARN_REMAINING", 3000));
  },
  /** Log a loud warning when refreshes spent more than this many accesses in 24 hours. */
  get dailyAccessWarning() {
    return Math.max(0, int("XWEATHER_DAILY_WARN", 300));
  },
  /** Monthly access budget `npm run provider:check` plans against (kept below the 15,000 free tier). */
  get monthlyAccessBudget() {
    return Math.max(1, int("XWEATHER_MONTHLY_BUDGET", 12000));
  },
  /** Xweather time step in hours: 1 (hourly) or 3 (3-hourly, resampled to hourly). */
  get xweatherIntervalHours(): 1 | 3 {
    return int("XWEATHER_INTERVAL_HOURS", 1) === 3 ? 3 : 1;
  },
  get xweatherApiUrl() {
    return str("XWEATHER_API_URL", "https://data.api.xweather.com");
  },
  get xweatherClientId() {
    return process.env.XWEATHER_CLIENT_ID?.trim() || null;
  },
  get xweatherClientSecret() {
    return process.env.XWEATHER_CLIENT_SECRET?.trim() || null;
  },
  /** "modelled" (sea level from the marine provider) or "admiralty" (official UKHO predictions). */
  get tideProvider(): "modelled" | "admiralty" {
    return str("TIDE_PROVIDER", "modelled") === "admiralty" ? "admiralty" : "modelled";
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
    return sanitizeUpstashUrl(process.env.UPSTASH_REDIS_REST_URL);
  },
  get upstashToken() {
    return sanitizeEnvValue("UPSTASH_REDIS_REST_TOKEN", process.env.UPSTASH_REDIS_REST_TOKEN);
  },
};
