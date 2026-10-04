import { DirectionArrow } from "@/components/forecast/DirectionArrow";
import { StarRating } from "@/components/forecast/StarRating";
import { formatMph, formatSurfRange, formatTimeRange, WIND_TYPE_LABELS } from "@/lib/format";
import { absoluteUrl } from "@/lib/seo";
import type { DayForecast } from "@/types/forecast";

/** One compact spot row for embeddable widgets. Links open the full site in a new tab. */
export function EmbedSpotRow({ name, path, day }: { name: string; path: string; day: DayForecast }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <a href={absoluteUrl(path)} target="_blank" rel="noopener" className="font-semibold hover:text-flag-deep">
          {name}
        </a>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {day.wind ? `${WIND_TYPE_LABELS[day.wind.type]} ${formatMph(day.wind.speedKmh)}` : ""}
          {day.bestWindow ? ` · Best ${formatTimeRange(day.bestWindow.start, day.bestWindow.end)}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {day.primarySwell && <DirectionArrow fromDeg={day.primarySwell.directionDeg} kind="swell" size={20} />}
        <span className="w-14 text-right font-bold font-mono tabular-nums">{formatSurfRange(day.surfMinFt, day.surfMaxFt)}</span>
        <StarRating rating={day.rating} size="sm" label={day.label} />
      </div>
    </li>
  );
}
