import { DayOverview } from "@/components/forecast/DayOverview";
import { getForecastBundle } from "@/lib/forecast/service";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Tomorrow's Surf Forecast",
  description: "Tomorrow's surf forecast for the UK: the best-rated spots, wave heights, winds, tides and surf windows.",
  path: "/tomorrow",
});

export default async function TomorrowPage() {
  const bundle = await getForecastBundle();
  return <DayOverview bundle={bundle} offset={1} title="Tomorrow's surf forecast" />;
}
