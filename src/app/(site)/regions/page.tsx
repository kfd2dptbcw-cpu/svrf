import Link from "next/link";
import { RatingBadge } from "@/components/forecast/RatingBadge";
import { StarRating } from "@/components/forecast/StarRating";
import { Container, PageHeader } from "@/components/ui/PageHeader";
import { getActiveRegions, getSpotsInRegion } from "@/lib/config";
import { getForecastBundle } from "@/lib/forecast/service";
import { rankSpots, todayKey } from "@/lib/forecast/selectors";
import { formatSurfRange } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Regional Surf Forecasts",
  description: "Surf forecasts by region: Cornwall, Devon, Dorset, Wales, Yorkshire, the North East, Scotland and Northern Ireland.",
  path: "/regions",
});

export default async function RegionsPage() {
  const bundle = await getForecastBundle();
  const today = todayKey();
  return (
    <Container>
      <PageHeader eyebrow="Regions" title="Regional surf forecasts">
        <p>From the Atlantic beaches of Cornwall to the North Sea reefs of Scotland — pick a region to see every spot.</p>
      </PageHeader>
      <ul className="grid gap-5 md:grid-cols-2">
        {getActiveRegions().map((region) => {
          const ranked = rankSpots(bundle, today, getSpotsInRegion(region.slug));
          return (
            <li key={region.slug} className="glass flex flex-col gap-4 p-6">
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">{region.country}</p>
                <h2 className="text-2xl font-semibold">
                  <Link href={`/surf/${region.slug}`} className="hover:text-ocean-600 dark:hover:text-ocean-300">
                    {region.name}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{region.description}</p>
              </div>
              <ul className="grid gap-1.5 text-sm">
                {(ranked.length > 0 ? ranked : getSpotsInRegion(region.slug).map((spot) => ({ spot, day: undefined }))).map(({ spot, day }) => (
                  <li key={spot.slug} className="flex items-center justify-between gap-2">
                    <Link href={spot.path} className="font-medium hover:text-ocean-600 dark:hover:text-ocean-300">
                      {spot.name}
                    </Link>
                    {day && (
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">{formatSurfRange(day.surfMinFt, day.surfMaxFt)}</span>
                        <StarRating rating={day.rating} size="sm" label={day.label} />
                        <RatingBadge rating={day.rating} label={day.label} className="hidden sm:inline-flex" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <Link href={`/surf/${region.slug}`} className="mt-auto text-sm font-semibold text-ocean-700 dark:text-ocean-300">
                Full {region.name} forecast →
              </Link>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
