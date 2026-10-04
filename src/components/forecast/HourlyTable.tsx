import { degreesToCompass } from "@/lib/forecast/engine/angles";
import { formatHour, formatMph, formatPeriod, formatSurfRange, formatTemp, WIND_TYPE_LABELS } from "@/lib/format";
import type { HourlyConditions } from "@/types/forecast";
import { DirectionArrow } from "./DirectionArrow";
import { RATING_BG } from "./rating-styles";
import { WeatherIcon } from "./WeatherIcon";

/** Hour-by-hour conditions (daylight hours) — scrolls horizontally on small screens. */
export function HourlyTable({ hours, caption }: { hours: HourlyConditions[]; caption: string }) {
  const rows = hours.filter((hour) => hour.isDaylight);
  if (rows.length === 0) return null;
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
            <th scope="col" className="py-2 pr-3 font-medium">Time</th>
            <th scope="col" className="py-2 pr-3 font-medium">Surf</th>
            <th scope="col" className="py-2 pr-3 font-medium">Swell</th>
            <th scope="col" className="py-2 pr-3 font-medium">Wind</th>
            <th scope="col" className="py-2 pr-3 font-medium">Tide</th>
            <th scope="col" className="py-2 font-medium">Weather</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((hour) => (
            <tr key={hour.time} className="border-t border-slate-900/5 dark:border-white/5">
              <th scope="row" className="border-t border-slate-900/5 py-2 pr-3 text-left font-medium tabular-nums dark:border-white/5">
                {formatHour(hour.time)}
              </th>
              <td className="border-t border-slate-900/5 py-2 pr-3 dark:border-white/5">
                <span className="flex items-center gap-2">
                  <span className={`h-6 w-1.5 rounded-full ${RATING_BG[hour.rating]}`} title={`Score ${hour.score}/10`} aria-hidden="true" />
                  <span className="font-semibold tabular-nums">{formatSurfRange(hour.surfMinFt, hour.surfMaxFt)}</span>
                </span>
              </td>
              <td className="border-t border-slate-900/5 py-2 pr-3 dark:border-white/5">
                {hour.primarySwell ? (
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <DirectionArrow fromDeg={hour.primarySwell.directionDeg} kind="swell" size={20} />
                    {hour.primarySwell.heightM.toFixed(1)}m {formatPeriod(hour.primarySwell.periodS)}{" "}
                    <span className="text-slate-500 dark:text-slate-400">{degreesToCompass(hour.primarySwell.directionDeg)}</span>
                  </span>
                ) : (
                  "–"
                )}
              </td>
              <td className="border-t border-slate-900/5 py-2 pr-3 dark:border-white/5">
                {hour.wind ? (
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <DirectionArrow fromDeg={hour.wind.directionDeg} kind="wind" windType={hour.wind.type} size={20} />
                    {formatMph(hour.wind.speedKmh)}
                    <span className="text-slate-500 dark:text-slate-400">{WIND_TYPE_LABELS[hour.wind.type]}</span>
                  </span>
                ) : (
                  "–"
                )}
              </td>
              <td className="border-t border-slate-900/5 py-2 pr-3 capitalize dark:border-white/5">
                {hour.tide ? `${hour.tide.phase} · ${hour.tide.trend}` : "–"}
              </td>
              <td className="border-t border-slate-900/5 py-2 dark:border-white/5">
                <span className="flex items-center gap-1.5 tabular-nums">
                  <WeatherIcon code={hour.weatherCode} className="h-4 w-4 text-amber-500 dark:text-amber-300" />
                  {formatTemp(hour.airTempC)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
