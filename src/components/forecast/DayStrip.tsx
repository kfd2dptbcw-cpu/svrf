import { formatShortDate, formatSurfRange, formatWeekday } from "@/lib/format";
import type { DayForecast } from "@/types/forecast";
import { RATING_BG } from "./rating-styles";
import { StarRating } from "./StarRating";

/** Compact 7-day overview; each day links to its detailed section on the page. */
export function DayStrip({ days, todayKey }: { days: DayForecast[]; todayKey: string }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((day) => (
        <li key={day.date}>
          <a
            href={`#day-${day.date}`}
            className="glass-subtle flex h-full flex-col gap-1.5 p-3 transition hover:bg-white/80 dark:hover:bg-white/[0.07]"
          >
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {day.date === todayKey ? "Today" : formatWeekday(day.date, "short")} · {formatShortDate(day.date)}
            </span>
            <span className="text-xl font-bold font-mono tabular-nums">{formatSurfRange(day.surfMinFt, day.surfMaxFt)}</span>
            <StarRating rating={day.rating} size="sm" label={day.label} />
            <span className={`mt-1 h-1 rounded-full ${RATING_BG[day.rating]}`} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ol>
  );
}
