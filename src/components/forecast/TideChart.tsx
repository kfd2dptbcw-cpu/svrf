import { formatClock, formatHour } from "@/lib/format";
import type { HourlyConditions, TideEvent } from "@/types/forecast";

interface Props {
  hours: HourlyConditions[];
  events: TideEvent[];
  window?: { start: number; end: number } | null;
}

/** Lightweight SVG tide curve for one day, with high/low water markers. */
export function TideChart({ hours, events, window }: Props) {
  const points = hours.filter((hour) => hour.tide !== null);
  if (points.length < 6) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Tide data unavailable for this day.</p>;
  }

  const width = 1000;
  const height = 170;
  const padX = 10;
  const padY = 30;
  const start = hours[0]!.time;
  const end = hours[hours.length - 1]!.time + 3600;
  const heights = points.map((hour) => hour.tide!.heightM);
  const min = Math.min(...heights, ...events.map((event) => event.heightM));
  const max = Math.max(...heights, ...events.map((event) => event.heightM));
  const range = max - min || 1;

  const x = (time: number) => padX + ((time - start) / (end - start)) * (width - padX * 2);
  const y = (h: number) => padY + (1 - (h - min) / range) * (height - padY * 2);

  const line = points.map((hour, i) => `${i === 0 ? "M" : "L"}${x(hour.time).toFixed(1)},${y(hour.tide!.heightM).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points[points.length - 1]!.time).toFixed(1)},${height} L${x(points[0]!.time).toFixed(1)},${height} Z`;
  const ticks = [6, 9, 12, 15, 18, 21].map((h) => start + h * 3600).filter((t) => t < end);

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height + 22}`} className="h-auto w-full" role="img" aria-label="Tide height through the day">
        <defs>
          <linearGradient id="tide-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#06abd4" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#06abd4" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {window && (
          <rect
            x={x(window.start)}
            y={0}
            width={Math.max(x(window.end) - x(window.start), 2)}
            height={height}
            className="fill-flag/10"
            rx={6}
          />
        )}
        <g className="text-slate-600 dark:text-slate-300">
          <path d={area} fill="url(#tide-fill)" />
          <path d={line} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" />
        </g>
        {events.map((event) => {
          const ex = x(event.time);
          const anchor = ex < 70 ? "start" : ex > width - 70 ? "end" : "middle";
          return (
          <g key={event.time}>
            <circle cx={ex} cy={y(event.heightM)} r={5} className="fill-ink dark:fill-chalk" />
            <text
              x={ex}
              y={event.type === "high" ? y(event.heightM) - 12 : y(event.heightM) + 24}
              textAnchor={anchor}
              className="fill-slate-600 text-[15px] font-medium dark:fill-slate-300"
            >
              {event.type === "high" ? "High" : "Low"} {formatClock(event.time)} · {event.heightM.toFixed(1)}m
            </text>
          </g>
          );
        })}
        {ticks.map((tick) => (
          <text key={tick} x={x(tick)} y={height + 16} textAnchor="middle" className="fill-slate-400 text-[14px]">
            {formatHour(tick)}
          </text>
        ))}
      </svg>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Modelled heights relative to mean sea level. Shaded area: best surf window. Not for navigation.
      </p>
      <figcaption className="sr-only">
        {events.map((event) => `${event.type === "high" ? "High" : "Low"} tide at ${formatClock(event.time)} (${event.heightM.toFixed(1)}m)`).join(", ")}
      </figcaption>
    </figure>
  );
}
