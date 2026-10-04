import { NextResponse } from "next/server";
import { getCacheStore } from "@/lib/cache";
import { spots } from "@/lib/config";
import { env } from "@/lib/env";
import { getForecastBundle } from "@/lib/forecast/service";
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
      // What the last refresh was charged by metered providers (e.g. Xweather), and the allowance left.
      lastRefreshUsage: bundle.apiUsage ?? null,
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
