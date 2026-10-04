import type { TideEvent, TidePhase, TideState } from "@/types/forecast";

/**
 * TIDE ANALYSIS
 * -------------
 * Providers supply an hourly sea-level series (and optionally the official
 * high/low water times). From the series we:
 *
 *  1. Find local maxima/minima and refine each turning point with a parabolic
 *     fit through the neighbouring samples, giving sub-hour accuracy.
 *  2. Classify every hour by where it sits between the surrounding low and
 *     high water: the bottom third is "low", the middle third "mid" and the
 *     top third "high". The trend is rising when the next turning point is a
 *     high water.
 */

/** Minimum spacing between turning points; semi-diurnal tides turn every ~6.2 h. */
const MIN_EVENT_SPACING_S = 3 * 3600;

export function findTideEvents(times: readonly number[], heights: readonly (number | null)[]): TideEvent[] {
  const events: TideEvent[] = [];
  for (let i = 1; i < heights.length - 1; i++) {
    const prev = heights[i - 1];
    const current = heights[i];
    const next = heights[i + 1];
    const time = times[i];
    if (prev == null || current == null || next == null || time === undefined) continue;

    const isHigh = current > prev && current >= next;
    const isLow = current < prev && current <= next;
    if (!isHigh && !isLow) continue;

    // Vertex of the parabola through the three samples (offset in steps).
    const denominator = prev - 2 * current + next;
    const offset = denominator === 0 ? 0 : (0.5 * (prev - next)) / denominator;
    const step = (times[i + 1] ?? time + 3600) - time;
    const refinedHeight = current - 0.25 * (prev - next) * offset;

    const event: TideEvent = {
      time: Math.round(time + offset * step),
      type: isHigh ? "high" : "low",
      heightM: Math.round(refinedHeight * 100) / 100,
    };

    const last = events[events.length - 1];
    if (last && last.type === event.type) {
      // Two turning points of the same kind in a row (surge noise): keep the more extreme.
      const moreExtreme = event.type === "high" ? event.heightM > last.heightM : event.heightM < last.heightM;
      if (moreExtreme) events[events.length - 1] = event;
      continue;
    }
    // A reversal much sooner than a real tide could turn is a wobble, not a tide.
    if (last && event.time - last.time < MIN_EVENT_SPACING_S) continue;
    events.push(event);
  }
  return events;
}

/** Classify the state of the tide at a given time from the surrounding events. */
export function tideStateAt(time: number, heightM: number | null, events: readonly TideEvent[]): TideState | null {
  if (heightM === null || events.length === 0) return null;

  let previous: TideEvent | undefined;
  let next: TideEvent | undefined;
  for (const event of events) {
    if (event.time <= time) previous = event;
    else {
      next = event;
      break;
    }
  }

  const reference = previous && next ? [previous, next] : [previous ?? next, undefined];
  const known = reference.filter((event): event is TideEvent => event !== undefined);
  const high = known.find((event) => event.type === "high") ?? events.find((event) => event.type === "high");
  const low = known.find((event) => event.type === "low") ?? events.find((event) => event.type === "low");

  const trend = next ? (next.type === "high" ? "rising" : "falling") : previous?.type === "low" ? "rising" : "falling";
  if (!high || !low || high.heightM === low.heightM) return { heightM, phase: "mid", trend };

  const fraction = (heightM - low.heightM) / (high.heightM - low.heightM);
  return { heightM: Math.round(heightM * 100) / 100, phase: phaseFromFraction(fraction), trend };
}

export function phaseFromFraction(fraction: number): TidePhase {
  if (fraction < 1 / 3) return "low";
  if (fraction > 2 / 3) return "high";
  return "mid";
}

/**
 * Build an hourly height series from high/low water events using the
 * standard cosine interpolation ("rule of twelfths" approximation). Used by
 * providers that only publish tidal events.
 */
export function interpolateTideHeights(events: readonly TideEvent[], times: readonly number[]): (number | null)[] {
  return times.map((time) => {
    for (let i = 0; i < events.length - 1; i++) {
      const a = events[i]!;
      const b = events[i + 1]!;
      if (time >= a.time && time <= b.time) {
        const progress = (time - a.time) / (b.time - a.time);
        const height = a.heightM + (b.heightM - a.heightM) * ((1 - Math.cos(Math.PI * progress)) / 2);
        return Math.round(height * 100) / 100;
      }
    }
    return null;
  });
}
