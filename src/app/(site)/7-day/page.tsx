import { DataStatus } from "@/components/forecast/DataStatus";
import { ForecastMatrix } from "@/components/forecast/ForecastMatrix";
import { Container, PageHeader, Section } from "@/components/ui/PageHeader";
import { getActiveRegions, getSpotsInRegion } from "@/lib/config";
import { env } from "@/lib/env";
import { getForecastBundle } from "@/lib/forecast/service";
import { upcomingDateKeys } from "@/lib/forecast/selectors";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "7-Day Surf Forecast",
  description: "The week ahead for UK surf: a 7-day outlook of wave heights and surf ratings for every spot, grouped by region.",
  path: "/7-day",
});

export default async function WeekPage() {
  const bundle = await getForecastBundle();
  const dateKeys = upcomingDateKeys(env.forecastDays);
  return (
    <Container>
      <PageHeader eyebrow="Week ahead" title="7-day surf forecast">
        <p>Plan your week: every spot&apos;s surf height and rating for the next seven days. Select a day for the hourly detail.</p>
      </PageHeader>
      <DataStatus bundle={bundle} />
      {getActiveRegions().map((region) => (
        <Section key={region.slug} title={region.name} id={region.slug}>
          <ForecastMatrix
            bundle={bundle}
            spots={getSpotsInRegion(region.slug)}
            dateKeys={dateKeys}
            caption={`7-day surf forecast for ${region.name}`}
          />
        </Section>
      ))}
    </Container>
  );
}
