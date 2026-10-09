/**
 * Refresh every forecast from the data providers and write it to the shared
 * cache (Upstash in production). This is the ONLY thing that calls the
 * providers; the site itself just reads the cache.
 *
 *   npm run refresh              # refuses if the last attempt was < 3 hours ago
 *   npm run refresh -- --force   # override the 3-hour guard
 *
 * Run daily at 06:05 UTC by .github/workflows/scheduled-refresh.yml. Reads .env.local
 * / .env for local runs. Exits non-zero if the refresh failed.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File not present — fine.
  }
}

const force = process.argv.slice(2).includes("--force");

const { configurationErrors } = await import("../src/lib/startup-check");
const { getCacheStore } = await import("../src/lib/cache");
const { env } = await import("../src/lib/env");
const { RefreshTooSoonError } = await import("../src/lib/forecast/refresh-guard");
const { recordAttemptUsage, runRefresh } = await import("../src/lib/forecast/refresh-job");

const problems = configurationErrors();
if (problems.length > 0) {
  console.error(`✖ Invalid configuration:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}

const store = getCacheStore();
// In CI the cache must be the shared one: a throwaway file cache would neither
// reach the site nor remember the 3-hour guard between runs.
if (process.env.CI && store.name !== "upstash") {
  console.error("✖ UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set; refusing to refresh into a local cache.");
  process.exit(1);
}

// If the runner kills us mid-refresh, still record the accesses already spent.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    console.error(`✖ Received ${signal}; recording usage and exiting`);
    void recordAttemptUsage(undefined, `interrupted by ${signal}`).finally(() => process.exit(1));
  });
}

console.log(`Refreshing ${env.dataSource} forecasts into the ${store.name} cache${force ? " (forced)" : ""}…`);
try {
  const result = await runRefresh({ force });
  const { bundle } = result;
  console.log(
    JSON.stringify(
      {
        status: bundle.status,
        generatedAt: new Date(bundle.generatedAt * 1000).toISOString(),
        spots: Object.keys(bundle.spots).length,
        accesses: result.accesses,
        accessesLast24h: result.accessesLast24h,
        remainingPeriod: bundle.apiUsage?.remainingPeriod ?? null,
        errors: bundle.errors,
      },
      null,
      2,
    ),
  );
  process.exit(0);
} catch (error) {
  if (error instanceof RefreshTooSoonError) {
    console.log(`Skipped: ${error.message}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Refresh skipped::${error.message}`);
    process.exit(0);
  }
  console.error(`✖ Refresh failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
