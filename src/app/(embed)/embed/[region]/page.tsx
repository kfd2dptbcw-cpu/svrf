import { notFound } from "next/navigation";
import { EmbedSpotRow } from "@/components/embed/EmbedSpotRow";
import { getActiveRegions, getRegion, getSpotsInRegion } from "@/lib/config";
import { getForecastBundle } from "@/lib/forecast/service";
import { rankSpots, todayKey } from "@/lib/forecast/selectors";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return getActiveRegions().map((region) => ({ region: region.slug }));
}

/** Widget: today's forecast for every spot in a region. */
export default async function EmbedRegionPage({ params }: { params: Promise<{ region: string }> }) {
  const region = getRegion((await params).region);
  if (!region) notFound();
  const bundle = await getForecastBundle();
  const ranked = rankSpots(bundle, todayKey(), getSpotsInRegion(region.slug));
  return (
    <>
      <h1 className="text-base font-semibold">{region.name} surf today</h1>
      {ranked.length > 0 ? (
        <ul className="divide-y divide-slate-900/5 dark:divide-white/5">
          {ranked.map(({ spot, day }) => (
            <EmbedSpotRow key={spot.slug} name={spot.name} path={spot.path} day={day} />
          ))}
        </ul>
      ) : (
        <p className="py-4 text-sm text-slate-500">Forecast temporarily unavailable.</p>
      )}
    </>
  );
}
