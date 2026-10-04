import { DayOverview } from "@/components/forecast/DayOverview";
import { getForecastBundle } from "@/lib/forecast/service";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Today's Surf Forecast",
  description: "Today's surf forecast for every major UK surf spot, ranked by quality with wave height, wind, tide and the best time to surf.",
  path: "/today",
});

export default async function TodayPage() {
  const bundle = await getForecastBundle();
  return <DayOverview bundle={bundle} offset={0} title="Today's surf forecast" />;
}
