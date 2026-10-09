import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataStatus } from "@/components/forecast/DataStatus";
import { ForecastHolding } from "@/components/forecast/ForecastHolding";
import { ForecastMatrix } from "@/components/forecast/ForecastMatrix";
import { SpotCard } from "@/components/forecast/SpotCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container, PageHeader, Section } from "@/components/ui/PageHeader";
import { getActiveRegions, getRegion, getSpotsInRegion } from "@/lib/config";
import { env } from "@/lib/env";
import { getForecastBundle } from "@/lib/forecast/service";
import { rankSpots, upcomingDateKeys } from "@/lib/forecast/selectors";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const revalidate = 3600;

type Params = Promise<{ region: string }>;

export function generateStaticParams() {
  return getActiveRegions().map((region) => ({ region: region.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const region = getRegion((await params).region);
  if (!region) return {};
  const names = getSpotsInRegion(region.slug).map((spot) => spot.name);
  return pageMetadata({
    title: `${region.name} Surf Forecast`,
    description: `Daily surf forecast for ${region.name}: ${names.join(", ")}. Wave height, swell, wind, tides and best surf times.`,
    path: `/surf/${region.slug}`,
  });
}

export default async function RegionPage({ params }: { params: Params }) {
  const region = getRegion((await params).region);
  if (!region) notFound();
  const regionSpots = getSpotsInRegion(region.slug);
  if (regionSpots.length === 0) notFound();

  const bundle = await getForecastBundle();
  const dateKeys = upcomingDateKeys(env.forecastDays);
  const [today, tomorrow] = dateKeys as [string, string];

  return (
    <Container>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Regions", path: "/regions" },
          { name: region.name, path: `/surf/${region.slug}` },
        ])}
      />
      <PageHeader eyebrow={`${region.country} · ${regionSpots.length} spots`} title={`${region.name} surf forecast`}>
        <p>{region.description}</p>
      </PageHeader>
      {bundle.status === "unavailable" ? (
        <>
          <ForecastHolding />
          <Section title={`Spots in ${region.name}`} id="spots">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {regionSpots.map((spot) => (
                <li key={spot.slug}>
                  <Link href={spot.path} className="glass block p-5 font-semibold transition hover:border-slate-400 dark:hover:border-slate-500">
                    {spot.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      ) : (
        <>
          <DataStatus bundle={bundle} />

          {[
            { key: today, title: "Today" },
            { key: tomorrow, title: "Tomorrow" },
          ].map(({ key, title }) => {
            const ranked = rankSpots(bundle, key, regionSpots);
            if (ranked.length === 0) return null;
            return (
              <Section key={key} title={title} id={title.toLowerCase()}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {ranked.map(({ spot, day }) => (
                    <SpotCard key={spot.slug} name={spot.name} regionName={region.name} href={spot.path} day={day} />
                  ))}
                </div>
              </Section>
            );
          })}

          <Section title="7-day outlook" id="outlook">
            <ForecastMatrix bundle={bundle} spots={regionSpots} dateKeys={dateKeys} caption={`7-day surf forecast for ${region.name}`} />
          </Section>
        </>
      )}
    </Container>
  );
}
