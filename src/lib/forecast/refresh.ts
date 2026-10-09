import "server-only";
import { getForecastBundle } from "./service";
import { accessesLast24h, readLastAttempt } from "./refresh-guard";

/**
 * Refresh status for /api/cron/refresh and /api/health. Read-only: refreshing
 * happens only in `npm run refresh` (GitHub Actions), never in a request.
 */
export async function getRefreshStatus() {
  const bundle = await getForecastBundle();
  const [lastAttempt, last24h] = await Promise.all([readLastAttempt().catch(() => null), accessesLast24h().catch(() => null)]);
  return {
    status: bundle.status,
    generatedAt: bundle.generatedAt > 0 ? new Date(bundle.generatedAt * 1000).toISOString() : null,
    nextRefreshAt: new Date(bundle.nextRefreshAt * 1000).toISOString(),
    lastRefreshAttemptAt: lastAttempt ? new Date(lastAttempt.at * 1000).toISOString() : null,
    accessesLast24h: last24h,
    spots: Object.keys(bundle.spots).length,
    errors: bundle.errors,
  };
}
