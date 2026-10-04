import { describe, expect, it } from "vitest";
import { findTideEvents, interpolateTideHeights, tideStateAt } from "@/lib/forecast/engine/tide";

const HOUR = 3600;
const PERIOD_H = 12.42;
const times = Array.from({ length: 48 }, (_, i) => 1_700_000_000 + i * HOUR);
const heights = times.map((_, i) => 2 * Math.cos((2 * Math.PI * i) / PERIOD_H));

describe("tide analysis", () => {
  it("finds alternating high and low waters about 6.2 hours apart", () => {
    const events = findTideEvents(times, heights);
    expect(events.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.type).not.toBe(events[i - 1]!.type);
      expect((events[i]!.time - events[i - 1]!.time) / HOUR).toBeCloseTo(PERIOD_H / 2, 0);
    }
    const high = events.find((event) => event.type === "high")!;
    expect(high.heightM).toBeCloseTo(2, 1);
  });

  it("refines turning points between hourly samples", () => {
    const events = findTideEvents(times, heights);
    const firstHigh = events.find((event) => event.type === "high")!;
    // The second high water is at 12.42 h, not on an hourly sample.
    expect((firstHigh.time - times[0]!) / HOUR).toBeCloseTo(12.42, 0);
  });

  it("classifies tide phase and trend", () => {
    const events = findTideEvents(times, heights);
    const nearHigh = tideStateAt(times[12]!, heights[12]!, events);
    expect(nearHigh?.phase).toBe("high");
    const midFalling = tideStateAt(times[15]!, heights[15]!, events);
    expect(midFalling?.phase).toBe("mid");
    expect(midFalling?.trend).toBe("falling");
    const nearLow = tideStateAt(times[18]!, heights[18]!, events);
    expect(nearLow?.phase).toBe("low");
  });

  it("interpolates heights between high and low water events", () => {
    const events = [
      { time: 0, type: "low" as const, heightM: 0.5 },
      { time: 6 * HOUR, type: "high" as const, heightM: 4.5 },
    ];
    const series = interpolateTideHeights(events, [0, 3 * HOUR, 6 * HOUR, 7 * HOUR]);
    expect(series[0]).toBe(0.5);
    expect(series[1]).toBeCloseTo(2.5, 5);
    expect(series[2]).toBe(4.5);
    expect(series[3]).toBeNull();
  });
});
