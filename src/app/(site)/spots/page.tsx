import { DataStatus } from "@/components/forecast/DataStatus";
import { SpotExplorer } from "@/components/explorer/SpotExplorer";
import { Container, PageHeader } from "@/components/ui/PageHeader";
import { getActiveRegions } from "@/lib/config";
import { getForecastBundle } from "@/lib/forecast/service";
import { buildSpotList, upcomingDateKeys } from "@/lib/forecast/selectors";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "All UK Surf Spots",
  description: "Search and filter every UK surf spot by region, wave height, skill level, surf rating and wind quality.",
  path: "/spots",
});

export default async function SpotsPage() {
  const bundle = await getForecastBundle();
  const dateKeys = upcomingDateKeys(2) as [string, string];
  return (
    <Container>
      <PageHeader eyebrow="Explore" title="All surf spots">
        <p>Find the right wave for you. Filter by region, size, skill level, rating and wind — filters are saved in the URL so you can share them.</p>
      </PageHeader>
      <div className="mb-6">
        <DataStatus bundle={bundle} compact />
      </div>
      <SpotExplorer
        spots={buildSpotList(bundle, dateKeys)}
        regions={getActiveRegions().map((region) => ({ slug: region.slug, name: region.name }))}
        dateKeys={dateKeys}
      />
    </Container>
  );
}
