import { NextResponse } from "next/server";
import { getRegion, getSpot, spots } from "@/lib/config";
import { getSpotForecast } from "@/lib/forecast/service";

export const revalidate = 3600;

export function generateStaticParams() {
  return spots.map((spot) => ({ spot: spot.slug }));
}

/** GET /api/forecast/:spot — the full hourly and daily forecast for one spot. */
export async function GET(_request: Request, { params }: { params: Promise<{ spot: string }> }) {
  const { spot: slug } = await params;
  const spot = getSpot(slug);
  if (!spot) return NextResponse.json({ error: "Unknown surf spot" }, { status: 404 });

  const { bundle, forecast } = await getSpotForecast(slug);
  return NextResponse.json(
    {
      status: bundle.status,
      spot: {
        slug: spot.slug,
        name: spot.name,
        region: getRegion(spot.region)?.name ?? spot.region,
        location: spot.location,
        path: spot.path,
      },
      forecast,
    },
    {
      status: forecast ? 200 : 503,
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=43200" },
    },
  );
}
