import { degreesToCompass } from "@/lib/forecast/engine/angles";
import type { WindType } from "@/types/forecast";

const WIND_COLOURS: Record<WindType, string> = {
  offshore: "text-emerald-500",
  "cross-offshore": "text-teal-500",
  "cross-shore": "text-amber-500",
  onshore: "text-rose-500",
};

interface Props {
  /** Direction the swell/wind comes FROM, degrees true. */
  fromDeg: number;
  kind: "swell" | "wind";
  windType?: WindType | null;
  size?: number;
  className?: string;
}

/**
 * Arrow pointing the way the swell/wind is travelling (i.e. from + 180°),
 * matching the convention used on surf forecast charts. Swell arrows drift
 * gently; wind arrows pulse — both respect prefers-reduced-motion.
 */
export function DirectionArrow({ fromDeg, kind, windType, size = 28, className = "" }: Props) {
  const rotation = (fromDeg + 180) % 360;
  const colour = kind === "swell" ? "text-ocean-500 dark:text-ocean-300" : windType ? WIND_COLOURS[windType] : "text-slate-500";
  const label = `${kind === "swell" ? "Swell" : "Wind"} from the ${degreesToCompass(fromDeg)} (${Math.round(fromDeg)}°)`;

  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${colour} ${className}`} role="img" aria-label={label} title={label}>
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ transform: `rotate(${rotation}deg)` }} aria-hidden="true">
        <g className={kind === "swell" ? "animate-swell" : "animate-gust"}>
          {kind === "swell" ? (
            <>
              <path d="M16 4 L23 14 H18.5 V27 H13.5 V14 H9 Z" fill="currentColor" />
              <path d="M10 30 q3 -2 6 0 t6 0" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
            </>
          ) : (
            <>
              <path d="M16 3 L22.5 13 H18 V28 H14 V13 H9.5 Z" fill="currentColor" />
              <path d="M18 20 h6 M18 24 h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
            </>
          )}
        </g>
      </svg>
    </span>
  );
}
