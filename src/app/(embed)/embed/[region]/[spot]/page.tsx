import { notFound } from "next/navigation";
import { EmbedEmpty } from "@/components/embed/EmbedEmpty";
import { RatingBadge } from "@/components/forecast/RatingBadge";
import { RATING_BG } from "@/components/forecast/rating-styles";
import { StarRating } from "@/components/forecast/StarRating";
import { getRegion, getSpot, spots } from "@/lib/config";
import { getSpotForecast } from "@/lib/forecast/service";
import { todayKey } from "@/lib/forecast/selectors";
import { formatSurfRange, formatWeekday } from "@/lib/format";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

export function generateStaticParams() {
  return spots.map((spot) => ({ region: spot.region, spot: spot.slug }));
}

/** Widget: one spot — today's forecast plus a 7-day strip. */
export default async function EmbedSpotPage({ params }: { params: Promise<{ region: string; spot: string }> }) {
  const { region: regionSlug, spot: spotSlug } = await params;
  const spot = getSpot(spotSlug);
  const region = getRegion(regionSlug);
  if (!spot || !region || spot.region !== region.slug) notFound();

  const { forecast } = await getSpotForecast(spot.slug);
  const today = todayKey();
  const days = forecast?.days.filter((day) => day.date >= today) ?? [];
  const current = days[0];
  if (!current) return <EmbedEmpty />;

  return (
    <>
      <p className="text-xs font-medium font-mono tracking-wide text-slate-600 uppercase dark:text-slate-400">{region.name}</p>
      <h1 className="text-lg font-semibold">
        <a href={absoluteUrl(spot.path)} target="_blank" rel="noopener" className="hover:text-flag-deep">
          {spot.name}
        </a>
      </h1>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-4xl font-bold font-mono tabular-nums">{formatSurfRange(current.surfMinFt, current.surfMaxFt)}</span>
        <div className="grid gap-1">
          <StarRating rating={current.rating} size="sm" label={current.label} />
          <RatingBadge rating={current.rating} label={current.label} />
        </div>
      </div>
      <div className="mt-2 space-y-0.5 text-sm text-slate-600 dark:text-slate-300">
        {current.summary.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <ol className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px]">
        {days.slice(0, 7).map((day) => (
          <li key={day.date} className="rounded-lg bg-slate-900/5 px-0.5 py-1 dark:bg-white/5">
            <span className="block text-slate-500">{day.date === today ? "Today" : formatWeekday(day.date, "short")}</span>
            <span className="block font-semibold font-mono tabular-nums">{formatSurfRange(day.surfMinFt, day.surfMaxFt)}</span>
            <span className={`mx-auto mt-1 block h-1 w-6 rounded-full ${RATING_BG[day.rating]}`} aria-label={day.label} />
          </li>
        ))}
      </ol>
    </>
  );
}
