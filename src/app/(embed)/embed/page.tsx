import { EmbedSpotRow } from "@/components/embed/EmbedSpotRow";
import { getForecastBundle } from "@/lib/forecast/service";
import { rankSpots, todayKey } from "@/lib/forecast/selectors";

export const revalidate = 3600;
export const metadata = { title: "Best UK surf today — widget" };

/** Widget: the top UK spots today. */
export default async function EmbedTopPage() {
  const bundle = await getForecastBundle();
  const ranked = rankSpots(bundle, todayKey()).slice(0, 8);
  return (
    <>
      <h1 className="text-base font-semibold">Best UK surf today</h1>
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
