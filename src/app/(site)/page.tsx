import Link from "next/link";
import { ArrowRight, CalendarDays, Map, Sunrise } from "lucide-react";
import { DataStatus } from "@/components/forecast/DataStatus";
import { RatingBadge } from "@/components/forecast/RatingBadge";
import { SpotCard } from "@/components/forecast/SpotCard";
import { MapSection } from "@/components/map/MapSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container, Section } from "@/components/ui/PageHeader";
import { getActiveRegions, getSpotsInRegion, spots } from "@/lib/config";
import { env } from "@/lib/env";
import { getForecastBundle } from "@/lib/forecast/service";
import { buildSpotList, rankSpots, upcomingDateKeys } from "@/lib/forecast/selectors";
import { formatFullDate, formatSurfRange } from "@/lib/format";
import { websiteJsonLd } from "@/lib/seo";

export const revalidate = 3600;

export default async function HomePage() {
  const bundle = await getForecastBundle();
  const [today, tomorrow] = upcomingDateKeys(2) as [string, string];
  const ranked = rankSpots(bundle, today);
  const goodCount = ranked.filter(({ day }) => day.rating >= 3).length;
  const regions = getActiveRegions();
  const mapSpots = buildSpotList(bundle, [today, tomorrow]);

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <section className="relative overflow-hidden">
        <Container className="pt-14 pb-10 sm:pt-20">
          <p className="text-sm font-semibold font-mono tracking-wide text-slate-600 uppercase dark:text-slate-400">{formatFullDate(today)}</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            {env.siteName}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            Twice-daily surf forecasts for {spots.length} of the UK&apos;s best breaks — wave height, swell, wind, tides and
            the best time to paddle out.
          </p>
          {ranked.length > 0 && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-flag/10 px-4 py-2 font-mono text-sm font-medium text-flag-deep ring-1 ring-flag/30 dark:text-flag">
              <Sunrise className="h-4 w-4" aria-hidden="true" />
              {goodCount > 0
                ? `${goodCount} ${goodCount === 1 ? "spot is" : "spots are"} rated Good or better today`
                : "No spots rated Good today — check tomorrow's outlook"}
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/today" className="inline-flex items-center gap-2 rounded-full bg-flag px-5 py-3 font-semibold text-ink transition hover:bg-flag-deep hover:text-chalk">
              Today&apos;s forecast <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/tomorrow" className="glass-subtle inline-flex items-center gap-2 !rounded-full px-5 py-3 font-semibold transition hover:bg-white/80 dark:hover:bg-white/10">
              Tomorrow
            </Link>
            <Link href="/7-day" className="glass-subtle inline-flex items-center gap-2 !rounded-full px-5 py-3 font-semibold transition hover:bg-white/80 dark:hover:bg-white/10">
              <CalendarDays className="h-4 w-4" aria-hidden="true" /> 7-day outlook
            </Link>
          </div>
          <div className="mt-8">
            <DataStatus bundle={bundle} />
          </div>
        </Container>
      </section>

      <Container>
        {ranked.length > 0 && (
          <Section title="Best surf today" id="best-today" description="The top-rated spots right now, across every region.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ranked.slice(0, 6).map(({ spot, day }, index) => (
                <SpotCard
                  key={spot.slug}
                  name={spot.name}
                  regionName={regions.find((region) => region.slug === spot.region)?.name ?? spot.region}
                  href={spot.path}
                  day={day}
                  rank={index + 1}
                  headingLevel="h3"
                />
              ))}
            </div>
          </Section>
        )}

        <Section
          title="Surf map"
          id="map"
          description={
            <span className="inline-flex items-center gap-1.5">
              <Map className="h-4 w-4" aria-hidden="true" /> Select a marker to see that spot&apos;s forecast.
            </span>
          }
        >
          <MapSection spots={mapSpots} dateKeys={[today, tomorrow]} />
        </Section>

        <Section title="Regional forecasts" id="regions">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {regions.map((region) => {
              const best = rankSpots(bundle, today, getSpotsInRegion(region.slug))[0];
              return (
                <li key={region.slug}>
                  <Link href={`/surf/${region.slug}`} className="glass flex h-full flex-col gap-2 p-5 transition hover:border-slate-400 dark:hover:border-slate-500">
                    <span className="text-lg font-semibold">{region.name}</span>
                    {best ? (
                      <span className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        Best today: <strong className="text-slate-900 dark:text-white">{best.spot.name}</strong>
                        {formatSurfRange(best.day.surfMinFt, best.day.surfMaxFt)}
                        <RatingBadge rating={best.day.rating} label={best.day.label} />
                      </span>
                    ) : (
                      <span className="text-sm text-slate-500">{getSpotsInRegion(region.slug).length} spots</span>
                    )}
                    <span className="mt-auto text-sm font-medium text-flag-deep dark:text-flag">View {region.name} forecast →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      </Container>
    </>
  );
}
