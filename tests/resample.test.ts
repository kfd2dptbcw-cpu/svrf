import { describe, expect, it } from "vitest";
import { hourlyTimes, resampleSeries } from "@/lib/providers/resample";

const H = 3600;
const times = [0, 3 * H, 6 * H];

describe("3-hourly to hourly resampling", () => {
  it("builds an hourly grid between the first and last sample", () => {
    expect(hourlyTimes(times)).toEqual([0, H, 2 * H, 3 * H, 4 * H, 5 * H, 6 * H]);
  });

  it("interpolates linear values", () => {
    expect(resampleSeries(times, [1, 4, 4], hourlyTimes(times), "linear")).toEqual([1, 2, 3, 4, 4, 4, 4]);
  });

  it("interpolates directions the short way through north", () => {
    const result = resampleSeries(times, [350, 20, 20], hourlyTimes(times), "circular");
    expect(result.slice(0, 4)).toEqual([350, 0, 10, 20]);
  });

  it("holds categorical values and leaves gaps where data is missing", () => {
    expect(resampleSeries(times, [1, 61, 3], hourlyTimes(times), "step")).toEqual([1, 1, 1, 61, 61, 61, 3]);
    expect(resampleSeries(times, [1, null, 3], hourlyTimes(times), "linear")).toEqual([1, null, null, null, null, null, 3]);
  });
});
