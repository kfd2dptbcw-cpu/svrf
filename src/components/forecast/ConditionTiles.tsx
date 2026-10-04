import { Clock, Thermometer, Waves } from "lucide-react";
import { degreesToCompass } from "@/lib/forecast/engine/angles";
import { formatClock, formatFeet, formatMph, formatPeriod, formatTemp, formatTimeRange, WIND_TYPE_LABELS } from "@/lib/format";
import type { DayForecast } from "@/types/forecast";
import { DirectionArrow } from "./DirectionArrow";

function Tile({ label, children, icon }: { label: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="glass-subtle flex flex-col gap-2 p-4">
      <dt className="flex items-center gap-1.5 text-xs font-medium font-mono tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</dt>
      <dd className="flex items-center gap-3">
        {icon}
        <div className="min-w-0">{children}</div>
      </dd>
    </div>
  );
}

/** Detailed conditions for the representative time of a day. */
export function ConditionTiles({ day }: { day: DayForecast }) {
  const swell = day.primarySwell;
  const wind = day.wind;
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Tile label="Primary swell" icon={swell ? <DirectionArrow fromDeg={swell.directionDeg} kind="swell" size={36} /> : null}>
        {swell ? (
          <>
            <p className="text-lg font-semibold font-mono tabular-nums">
              {swell.heightM.toFixed(1)}m <span className="text-slate-400">@</span> {formatPeriod(swell.periodS)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {degreesToCompass(swell.directionDeg)} ({swell.directionDeg}°) · {formatFeet(swell.heightM)}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">No swell data</p>
        )}
      </Tile>
      <Tile label="Wind" icon={wind ? <DirectionArrow fromDeg={wind.directionDeg} kind="wind" windType={wind.type} size={36} /> : null}>
        {wind ? (
          <>
            <p className="text-lg font-semibold font-mono tabular-nums">
              {formatMph(wind.speedKmh)} <span className="text-sm font-normal text-slate-500">gust {formatMph(wind.gustKmh)}</span>
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {WIND_TYPE_LABELS[wind.type]} · from {degreesToCompass(wind.directionDeg)}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">No wind data</p>
        )}
      </Tile>
      <Tile label="Tide" icon={<Waves className="h-8 w-8 text-slate-600 dark:text-slate-300" aria-hidden="true" />}>
        {day.tideEvents.length > 0 ? (
          <ul className="text-sm font-mono tabular-nums">
            {day.tideEvents.map((event) => (
              <li key={event.time}>
                <span className="font-semibold">{event.type === "high" ? "High" : "Low"}</span> {formatClock(event.time)}{" "}
                <span className="text-slate-500 dark:text-slate-400">({event.heightM.toFixed(1)}m)</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Tide data unavailable</p>
        )}
      </Tile>
      <Tile label="Best surf window" icon={<Clock className="h-8 w-8 text-flag" aria-hidden="true" />}>
        {day.bestWindow ? (
          <>
            <p className="text-lg font-semibold">{formatTimeRange(day.bestWindow.start, day.bestWindow.end)}</p>
            <p className="text-sm text-slate-500 capitalize dark:text-slate-400">
              {day.bestWindow.tidePhase ? `${day.bestWindow.tidePhase} tide, ${day.bestWindow.tideTrend}` : "Tide n/a"}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">No clear window</p>
        )}
      </Tile>
      <Tile label="Air temperature" icon={<Thermometer className="h-8 w-8 text-slate-600 dark:text-slate-300" aria-hidden="true" />}>
        <p className="text-lg font-semibold font-mono tabular-nums">
          {formatTemp(day.airTempMaxC)} <span className="text-sm font-normal text-slate-500">/ low {formatTemp(day.airTempMinC)}</span>
        </p>
        {day.sunrise && day.sunset && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sunrise {formatClock(day.sunrise)} · Sunset {formatClock(day.sunset)}
          </p>
        )}
      </Tile>
      <Tile label="Sea temperature" icon={<Thermometer className="h-8 w-8 text-slate-600 dark:text-slate-300" aria-hidden="true" />}>
        <p className="text-lg font-semibold font-mono tabular-nums">{formatTemp(day.seaTempC)}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{wetsuitAdvice(day.seaTempC)}</p>
      </Tile>
    </dl>
  );
}

function wetsuitAdvice(seaTemp: number | null): string {
  if (seaTemp === null) return "Not available";
  if (seaTemp < 10) return "5/4mm, boots, gloves & hood";
  if (seaTemp < 13) return "5/4mm wetsuit & boots";
  if (seaTemp < 16) return "4/3mm wetsuit";
  if (seaTemp < 18) return "3/2mm wetsuit";
  return "Shortie or 3/2mm";
}
