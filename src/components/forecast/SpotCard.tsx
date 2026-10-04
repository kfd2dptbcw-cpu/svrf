import Link from "next/link";
import { Clock, Thermometer, Waves } from "lucide-react";
import { degreesToCompass } from "@/lib/forecast/engine/angles";
import { formatMph, formatPeriod, formatSurfRange, formatTemp, formatTimeRange, WIND_TYPE_LABELS } from "@/lib/format";
import type { DayForecast } from "@/types/forecast";
import { DirectionArrow } from "./DirectionArrow";
import { RatingBadge } from "./RatingBadge";
import { StarRating } from "./StarRating";
import { SuitabilityBadges } from "./SuitabilityBadges";
import { WeatherIcon } from "./WeatherIcon";

interface Props {
  name: string;
  regionName: string;
  href: string;
  day: DayForecast;
  rank?: number;
  /** Heading level for the spot name, to keep page outlines valid. */
  headingLevel?: "h2" | "h3";
}

/** Large glassmorphism forecast card for one spot on one day. */
export function SpotCard({ name, regionName, href, day, rank, headingLevel = "h3" }: Props) {
  const Heading = headingLevel;
  const swell = day.primarySwell;
  const wind = day.wind;
  return (
    <article className="glass group relative flex flex-col gap-4 p-5 transition hover:border-slate-400 dark:hover:border-slate-500 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium font-mono tracking-wide text-slate-600 uppercase dark:text-slate-400">
            {rank !== undefined && <span className="mr-1.5 text-slate-400">#{rank}</span>}
            {regionName}
          </p>
          <Heading className="mt-0.5 truncate text-lg font-semibold">
            <Link href={href} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none">
              {name}
            </Link>
          </Heading>
        </div>
        <WeatherIcon code={day.weatherCode} className="h-6 w-6 shrink-0 text-slate-600 dark:text-slate-300" />
      </header>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-4xl font-bold tracking-tight font-mono tabular-nums">{formatSurfRange(day.surfMinFt, day.surfMaxFt)}</p>
          <div className="mt-2 flex items-center gap-2">
            <StarRating rating={day.rating} size="sm" label={day.label} />
            <RatingBadge rating={day.rating} label={day.label} />
          </div>
        </div>
        <dl className="grid gap-1.5 text-right text-sm">
          {swell && (
            <div className="flex items-center justify-end gap-1.5">
              <dt className="sr-only">Primary swell</dt>
              <dd className="font-mono tabular-nums">
                {swell.heightM.toFixed(1)}m · {formatPeriod(swell.periodS)} {degreesToCompass(swell.directionDeg)}
              </dd>
              <DirectionArrow fromDeg={swell.directionDeg} kind="swell" size={22} />
            </div>
          )}
          {wind && (
            <div className="flex items-center justify-end gap-1.5">
              <dt className="sr-only">Wind</dt>
              <dd className="font-mono tabular-nums">
                {formatMph(wind.speedKmh)} {WIND_TYPE_LABELS[wind.type].toLowerCase()}
              </dd>
              <DirectionArrow fromDeg={wind.directionDeg} kind="wind" windType={wind.type} size={22} />
            </div>
          )}
        </dl>
      </div>

      <div className="space-y-0.5 text-sm text-slate-600 dark:text-slate-300">
        {day.summary.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-900/5 pt-3 text-xs text-slate-500 dark:border-white/5 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {day.bestWindow ? formatTimeRange(day.bestWindow.start, day.bestWindow.end) : "No clear window"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
          Air {formatTemp(day.airTempMaxC)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Waves className="h-3.5 w-3.5" aria-hidden="true" />
          Sea {formatTemp(day.seaTempC)}
        </span>
        <div className="relative z-10 w-full">
          <SuitabilityBadges suitability={day.suitability} />
        </div>
      </footer>
    </article>
  );
}
