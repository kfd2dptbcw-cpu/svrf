import { EmbedEmpty } from "@/components/embed/EmbedEmpty";
import { EmbedSpotRow } from "@/components/embed/EmbedSpotRow";
import { getForecastBundle } from "@/lib/forecast/service";
import { rankSpots, todayKey } from "@/lib/forecast/selectors";

export const revalidate = 3600;
export const metadata = { title: "Best UK surf today — widget" };

/** Widget: the top UK spots today. */
export default async function EmbedTopPage() {
  const bundle = await getForecastBundle();
  const ranked = rankSpots(bundle, todayKey()).slice(0, 8);
  if (ranked.length === 0) return <EmbedEmpty />;
  return (
    <>
      <h1 className="text-base font-semibold">Best UK surf today</h1>
      <ul className="divide-y divide-slate-900/5 dark:divide-white/5">
        {ranked.map(({ spot, day }) => (
          <EmbedSpotRow key={spot.slug} name={spot.name} path={spot.path} day={day} />
        ))}
      </ul>
    </>
  );
}
