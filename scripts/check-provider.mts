/**
 * Check a data provider against one real spot and report what came back.
 *
 *   npm run provider:check                     # active provider, Fistral
 *   npm run provider:check -- croyde           # another spot
 *   npm run provider:check -- fistral xweather # force a provider
 *
 * Reads .env.local / .env for credentials. Costs 2 API accesses on Xweather.
 * Exits non-zero if the data is missing or implausible, printing what to fix.
 */
import { getSpot } from "../src/lib/config";
import { buildSpotForecast, toEngineSpot } from "../src/lib/forecast/engine";
import { formatSurfRange } from "../src/lib/format";
import type { Series } from "../src/lib/providers/types";
import { summariseUsage, takeUsage } from "../src/lib/providers/usage";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File not present — fine.
  }
}

const [slug = "fistral", forced] = process.argv.slice(2);
if (forced) process.env.FORECAST_DATA_SOURCE = forced;
process.env.FALLBACK_DATA_SOURCE = "none";

const { env } = await import("../src/lib/env");
const { getProviders } = await import("../src/lib/providers/registry");

const spot = getSpot(slug);
if (!spot) {
  console.error(`Unknown spot "${slug}"`);
  process.exit(1);
}

const providers = getProviders();
const context = { days: env.forecastDays };
console.log(`Provider: ${env.dataSource} · spot: ${spot.name} · marine point ${spot.marinePoint.lat}, ${spot.marinePoint.lon}\n`);

const problems: string[] = [];
const point = { slug: spot.slug, ...spot.marinePoint, stationId: spot.tideStationId };
async function attempt<T>(label: string, task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    console.error(`✖ ${label} request failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const marine = (await attempt("Marine", () => providers.marine.fetchMarine([point], context)))[spot.slug];
if (!marine) {
  console.error("✖ No marine data returned for this location.");
  process.exit(1);
}
const weather = (await attempt("Weather", () => providers.weather.fetchWeather([{ slug: spot.slug, ...spot.location }], context)))[spot.slug];
const tide = (await attempt("Tide", () => providers.tide.fetchTides([point], { ...context, marine: { [spot.slug]: marine } })))[spot.slug];

function report(label: string, values: Series | undefined, [min, max]: [number, number], required: boolean) {
  const present = (values ?? []).filter((v): v is number => v !== null);
  const coverage = values && values.length ? Math.round((present.length / values.length) * 100) : 0;
  const lo = present.length ? Math.min(...present) : NaN;
  const hi = present.length ? Math.max(...present) : NaN;
  const ok = present.length > 0 && lo >= min && hi <= max;
  const mark = ok ? "✔" : required ? "✖" : "•";
  console.log(`${mark} ${label.padEnd(26)} ${String(coverage).padStart(3)}% present   range ${present.length ? `${lo.toFixed(1)} – ${hi.toFixed(1)}` : "–"}`);
  if (!ok && required) problems.push(`${label}: ${present.length ? `values outside ${min}–${max}` : "missing"}`);
}

console.log(`Marine: ${marine.time.length} hourly periods from ${new Date((marine.time[0] ?? 0) * 1000).toISOString()}`);
report("wave height (m)", marine.waveHeight, [0, 20], true);
report("swell height (m)", marine.swellHeight, [0, 20], true);
report("swell period (s)", marine.swellPeriod, [2, 30], true);
report("swell direction (°)", marine.swellDirection, [0, 360], true);
report("secondary swell (m)", marine.secondarySwellHeight, [0, 20], false);
report("wind-wave height (m)", marine.windWaveHeight, [0, 20], false);
report("sea temperature (°C)", marine.seaSurfaceTemperature, [-2, 30], false);
report("sea level / tide (m)", marine.seaLevel, [-10, 10], false);

if (weather) {
  console.log(`\nWeather: ${weather.time.length} hourly periods, ${weather.daily.sunrise.length} sunrises`);
  report("wind speed (km/h)", weather.windSpeed, [0, 250], true);
  report("wind direction (°)", weather.windDirection, [0, 360], true);
  report("wind gusts (km/h)", weather.windGusts, [0, 300], false);
  report("air temperature (°C)", weather.temperature, [-30, 45], true);
  report("weather code (WMO)", weather.weatherCode, [0, 99], false);
} else {
  problems.push("weather: no data returned");
}

const forecast = buildSpotForecast(
  spot.slug,
  toEngineSpot(spot),
  { marine, weather: weather ?? null, tide: tide ?? null },
  Math.floor(Date.now() / 1000),
);
console.log(`\nTide events found: ${forecast.days.reduce((n, day) => n + day.tideEvents.length, 0)} (source: ${tide?.source ?? "none"})`);
console.log("\nDaily forecast:");
for (const day of forecast.days) {
  console.log(`  ${day.date}  ${formatSurfRange(day.surfMinFt, day.surfMaxFt).padEnd(7)} ${"★".repeat(day.rating).padEnd(5)} ${day.label.padEnd(9)} ${day.summary[0] ?? ""}`);
}
if (forecast.days.length < env.forecastDays - 1) problems.push(`only ${forecast.days.length} complete days built`);

// ── Real cost, from the provider's own usage headers (Xweather: X-Cost-Tokens) ──
const usage = summariseUsage(takeUsage());
if (usage.endpoints.length > 0) {
  const { spots } = await import("../src/lib/config");
  const { detectBilling, planBudget, temporalMultiplier } = await import("../src/lib/providers/budget");
  const refreshesPerDay = env.refreshHoursUtc.length;
  const budget = env.monthlyAccessBudget;
  const current = { days: env.forecastDays, intervalHours: env.xweatherIntervalHours };

  console.log("\nAPI cost (as charged by the provider):");
  const measured = usage.endpoints.map((endpoint) => {
    const temporal = temporalMultiplier(endpoint.multipliers);
    const billing = detectBilling(temporal, current.days, current.intervalHours);
    console.log(
      `  ${endpoint.name.padEnd(22)} ${String(endpoint.tokens).padStart(4)} accesses for ${endpoint.requests} request(s)` +
        `   billing: ${billing}` +
        (endpoint.multipliers.length ? `   [${endpoint.multipliers.join(" | ")}]` : ""),
    );
    return { name: endpoint.name, tokensPerRequest: endpoint.tokens / endpoint.requests, temporal };
  });
  if (usage.remainingPeriod !== null) console.log(`  Left this billing period: ${usage.remainingPeriod.toLocaleString("en-GB")}`);

  const options = planBudget({ endpoints: measured, current, spots: spots.length, refreshesPerDay, budget });
  console.log(`\nProjected monthly usage (${spots.length} spots × ${refreshesPerDay} refreshes/day × 31 days, budget ${budget.toLocaleString("en-GB")}):`);
  for (const option of options) {
    const isCurrent = option.days === current.days && option.intervalHours === current.intervalHours;
    console.log(
      `  ${option.fits ? "✔" : "✖"} ${option.intervalHours}-hourly, ${option.days} days   ${option.monthly.toLocaleString("en-GB").padStart(8)}` +
        (isCurrent ? "   ← current settings" : ""),
    );
  }
  const currentOption = options.find((o) => o.days === current.days && o.intervalHours === current.intervalHours);
  const best = options.find((option) => option.fits);
  if (currentOption && !currentOption.fits) {
    problems.push(
      best
        ? `current settings exceed the ${budget.toLocaleString("en-GB")} budget — set XWEATHER_INTERVAL_HOURS=${best.intervalHours} and FORECAST_DAYS=${best.days}`
        : `no supported interval/day setting fits ${budget.toLocaleString("en-GB")} accesses — reduce REFRESH_HOURS_UTC to one refresh a day or disable some spots`,
    );
  } else if (!currentOption && best) {
    console.log(`  Recommended: XWEATHER_INTERVAL_HOURS=${best.intervalHours} FORECAST_DAYS=${best.days}`);
  }
} else if (env.dataSource === "xweather") {
  console.log("\n• Xweather did not return X-Cost-Tokens headers; check usage in the Xweather account dashboard.");
}

if (problems.length) {
  console.error(`\n✖ ${problems.length} problem(s):\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log("\n✔ Provider data looks complete and plausible.");
