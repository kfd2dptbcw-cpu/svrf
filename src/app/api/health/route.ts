import { NextResponse } from "next/server";
import { getCacheStore } from "@/lib/cache";
import { spots } from "@/lib/config";
import { env } from "@/lib/env";
import { accessesLast24h, readLastAttempt, warnIfOverDailyBudget } from "@/lib/forecast/refresh-guard";
import { getForecastBundle } from "@/lib/forecast/service";
import { isBelowFloor, loadAllowance } from "@/lib/providers/allowance";
import { nowSeconds } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — for uptime monitors. 200 while forecasts are being served
 * (`degraded: true` when only a stale fallback is available), 503 when there is
 * no forecast to show at all.
 */
export async function GET() {
  const bundle = await getForecastBundle();
  const healthy = bundle.status !== "unavailable";
  const usesXweather = env.dataSource === "xweather" || env.fallbackDataSource === "xweather";
  const [allowance, last24h, lastAttempt] = await Promise.all([
    usesXweather ? loadAllowance("xweather") : null,
    accessesLast24h().catch(() => null),
    readLastAttempt().catch(() => null),
  ]);
  if (last24h !== null) warnIfOverDailyBudget(last24h);
  return NextResponse.json(
    {
      ok: healthy,
      degraded: bundle.status === "stale",
      status: bundle.status,
      dataSource: env.dataSource,
      cache: getCacheStore().name,
      generatedAt: bundle.generatedAt > 0 ? new Date(bundle.generatedAt * 1000).toISOString() : null,
      ageMinutes: bundle.generatedAt > 0 ? Math.round((nowSeconds() - bundle.generatedAt) / 60) : null,
      nextRefreshAt: new Date(bundle.nextRefreshAt * 1000).toISOString(),
      spotsConfigured: spots.length,
      spotsWithForecast: Object.keys(bundle.spots).length,
      errors: bundle.errors,
      // API accesses charged by every refresh attempt (failed ones included) in the last 24 hours.
      accessesLast24h: last24h,
      accessesDailyWarning: env.dailyAccessWarning,
      lastRefreshAttemptAt: lastAttempt ? new Date(lastAttempt.at * 1000).toISOString() : null,
      // What the last refresh was charged by metered providers (e.g. Xweather), and the allowance left.
      lastRefreshUsage: bundle.apiUsage ?? null,
      // Latest Xweather allowance reading; refreshes pause while `paused` is true.
      allowance: allowance
        ? {
            remaining: allowance.remaining,
            resetAt: allowance.resetAt ? new Date(allowance.resetAt * 1000).toISOString() : null,
            observedAt: new Date(allowance.observedAt * 1000).toISOString(),
            warnBelow: env.warnRemainingAllowance,
            pauseBelow: env.minRemainingAllowance,
            paused: isBelowFloor(allowance),
          }
        : null,
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
