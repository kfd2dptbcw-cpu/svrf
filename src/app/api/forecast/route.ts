import { NextResponse } from "next/server";
import { getForecastBundle } from "@/lib/forecast/service";
import { buildSpotList, upcomingDateKeys } from "@/lib/forecast/selectors";
import { env } from "@/lib/env";

export const revalidate = 3600;

/**
 * GET /api/forecast — daily summaries for every spot. Intended for
 * integrations (alerts, email digests, partner widgets, apps).
 */
export async function GET() {
  const bundle = await getForecastBundle();
  const dateKeys = upcomingDateKeys(env.forecastDays);
  return NextResponse.json(
    {
      status: bundle.status,
      generatedAt: bundle.generatedAt > 0 ? new Date(bundle.generatedAt * 1000).toISOString() : null,
      nextRefreshAt: new Date(bundle.nextRefreshAt * 1000).toISOString(),
      sources: bundle.sources,
      dates: dateKeys,
      spots: buildSpotList(bundle, dateKeys),
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=43200" } },
  );
}
