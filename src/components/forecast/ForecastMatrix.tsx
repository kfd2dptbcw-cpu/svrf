import Link from "next/link";
import type { ResolvedSpot } from "@/lib/config";
import { getDay } from "@/lib/forecast/selectors";
import { formatShortDate, formatSurfRange, formatWeekday } from "@/lib/format";
import type { ForecastBundle } from "@/types/forecast";
import { RATING_SOFT } from "./rating-styles";

/** Spots × days grid of ratings and surf size — the "7-day at a glance" view. */
export function ForecastMatrix({
  bundle,
  spots,
  dateKeys,
  caption,
}: {
  bundle: ForecastBundle;
  spots: readonly ResolvedSpot[];
  dateKeys: string[];
  caption: string;
}) {
  return (
    <div className="glass overflow-x-auto p-2 sm:p-4">
      <table className="w-full min-w-[760px] border-separate border-spacing-1 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="px-2 py-2 text-left text-xs font-medium font-mono tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Spot
            </th>
            {dateKeys.map((key, index) => (
              <th key={key} scope="col" className="px-1 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className="block font-semibold text-slate-700 dark:text-slate-200">
                  {index === 0 ? "Today" : formatWeekday(key, "short")}
                </span>
                {formatShortDate(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spots.map((spot) => (
            <tr key={spot.slug}>
              <th scope="row" className="px-2 py-1 text-left font-medium whitespace-nowrap">
                <Link href={spot.path} className="hover:text-flag-deep dark:hover:text-flag">
                  {spot.name}
                </Link>
              </th>
              {dateKeys.map((key) => {
                const day = getDay(bundle.spots[spot.slug], key);
                return (
                  <td key={key} className="p-0">
                    {day ? (
                      <Link
                        href={`${spot.path}#day-${key}`}
                        className={`flex flex-col items-center rounded-xl px-1 py-1.5 ring-1 ring-inset transition hover:brightness-110 ${RATING_SOFT[day.rating]}`}
                        aria-label={`${spot.name}, ${formatWeekday(key)}: ${formatSurfRange(day.surfMinFt, day.surfMaxFt)}, ${day.label}`}
                      >
                        <span className="font-semibold font-mono tabular-nums">{formatSurfRange(day.surfMinFt, day.surfMaxFt)}</span>
                        <span className="text-[10px] tracking-tight" aria-hidden="true">
                          {"★".repeat(day.rating)}
                          <span className="opacity-30">{"★".repeat(5 - day.rating)}</span>
                        </span>
                      </Link>
                    ) : (
                      <span className="block py-2 text-center text-slate-400">–</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
