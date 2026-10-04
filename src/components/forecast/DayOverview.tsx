import Link from "next/link";
import { Container, PageHeader, Section } from "@/components/ui/PageHeader";
import { getActiveRegions, getSpotsInRegion } from "@/lib/config";
import { rankSpots, upcomingDateKeys } from "@/lib/forecast/selectors";
import { formatFullDate } from "@/lib/format";
import type { ForecastBundle } from "@/types/forecast";
import { DataStatus } from "./DataStatus";
import { SpotCard } from "./SpotCard";

/** Shared body of the Today and Tomorrow pages. */
export function DayOverview({ bundle, offset, title }: { bundle: ForecastBundle; offset: 0 | 1; title: string }) {
  const dateKey = upcomingDateKeys(offset + 1)[offset]!;
  const ranked = rankSpots(bundle, dateKey);
  const top = ranked.slice(0, 3);
  const regions = getActiveRegions();

  return (
    <Container>
      <PageHeader eyebrow={formatFullDate(dateKey)} title={title}>
        <p>
          Every spot ranked by our surf quality score, with the best time to paddle out.{" "}
          <Link href={`/spots?day=${offset === 0 ? "today" : "tomorrow"}`} className="font-medium text-flag-deep hover:underline dark:text-flag">
            Filter by skill, wind and size →
          </Link>
        </p>
      </PageHeader>
      <DataStatus bundle={bundle} />

      {ranked.length > 0 && (
        <Section title="Top picks" id="top-picks" description="The highest-rated spots in the UK.">
          <div className="grid gap-4 md:grid-cols-3">
            {top.map(({ spot, day }, index) => (
              <SpotCard
                key={spot.slug}
                name={spot.name}
                regionName={regions.find((region) => region.slug === spot.region)?.name ?? spot.region}
                href={spot.path}
                day={day}
                rank={index + 1}
              />
            ))}
          </div>
        </Section>
      )}

      {regions.map((region) => {
        const regional = rankSpots(bundle, dateKey, getSpotsInRegion(region.slug));
        if (regional.length === 0) return null;
        return (
          <Section key={region.slug} title={region.name} id={region.slug}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {regional.map(({ spot, day }) => (
                <SpotCard key={spot.slug} name={spot.name} regionName={region.name} href={spot.path} day={day} />
              ))}
            </div>
          </Section>
        );
      })}
    </Container>
  );
}
