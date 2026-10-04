import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FallbackMarineProvider } from "@/lib/providers/fallback";
import type { MarineProvider } from "@/lib/providers/types";
import { XweatherMarineProvider, XweatherWeatherProvider, xweatherCodeToWmo } from "@/lib/providers/xweather";

/**
 * Responses below are hand-written fixtures shaped like Xweather's documented
 * `{ success, error, response: { periods } }` envelope. They are test data,
 * not real forecasts.
 */
const T0 = 1_791_158_400; // a top-of-hour timestamp

function ok(periods: object[]) {
  return new Response(JSON.stringify({ success: true, error: null, response: [{ loc: {}, periods }] }), { status: 200 });
}

function maritimePeriod(i: number) {
  return {
    timestamp: T0 + i * 3600,
    significantWaveHeightM: 2.1,
    primaryWaveDirDEG: 285,
    primaryWavePeriod: 12,
    swellHeightM: 1.8,
    swellDirDEG: 290,
    swellPeriod: 13,
    swell2HeightM: 0.4,
    swell2DirDEG: 200,
    swell2Period: 7,
    windWaveHeightM: 0.5,
    seaSurfaceTemperatureC: 14.2,
    tidesM: 2 * Math.cos((2 * Math.PI * i) / 12.42),
  };
}

const points = [
  { slug: "fistral", lat: 50.43, lon: -5.18 },
  { slug: "croyde", lat: 51.13, lon: -4.33 },
];
const context = { days: 2 };

describe("Xweather providers", () => {
  beforeEach(() => {
    vi.stubEnv("XWEATHER_CLIENT_ID", "id");
    vi.stubEnv("XWEATHER_CLIENT_SECRET", "secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("maps maritime periods to marine series, keeping only top-of-hour periods", async () => {
    const periods = Array.from({ length: 48 }, (_, i) => maritimePeriod(i));
    periods.splice(5, 0, { ...maritimePeriod(4), timestamp: T0 + 4 * 3600 + 1800 }); // half-hour period
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(ok(periods)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new XweatherMarineProvider().fetchMarine(points, context);
    const fistral = result.fistral!;
    expect(fistral.time).toHaveLength(48);
    expect(fistral.swellHeight[0]).toBe(1.8);
    expect(fistral.swellPeriod[0]).toBe(13);
    expect(fistral.swellDirection[0]).toBe(290);
    expect(fistral.secondarySwellHeight[0]).toBe(0.4);
    expect(fistral.seaSurfaceTemperature[0]).toBe(14.2);
    expect(fistral.seaLevel[0]).toBeCloseTo(2, 5);

    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.pathname).toMatch(/^\/maritime\/50\.4300,-5\.1800$/);
    expect(url.searchParams.get("filter")).toBe("1hr");
    expect(url.searchParams.get("client_id")).toBe("id");
    // One access per spot.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps forecast periods to weather series and adds calculated sun times", async () => {
    const periods = Array.from({ length: 48 }, (_, i) => ({
      timestamp: T0 + i * 3600,
      tempC: 15,
      windSpeedKPH: 18,
      windGustKPH: 30,
      windDirDEG: 120,
      weatherPrimaryCoded: "::FW",
    }));
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(ok(periods))));

    const result = await new XweatherWeatherProvider().fetchWeather(points.slice(0, 1), context);
    const fistral = result.fistral!;
    expect(fistral.windSpeed[0]).toBe(18);
    expect(fistral.windDirection[0]).toBe(120);
    expect(fistral.weatherCode[0]).toBe(1);
    expect(fistral.daily.sunrise.length).toBeGreaterThanOrEqual(2);
    expect(fistral.daily.sunset[0]).toBeGreaterThan(fistral.daily.sunrise[0]!);
  });

  it("skips spots Xweather has no data for", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          url.includes("50.4300")
            ? ok([maritimePeriod(0), maritimePeriod(1)])
            : new Response(JSON.stringify({ success: false, error: { code: "warn_no_data" }, response: [] })),
        ),
      ),
    );
    const result = await new XweatherMarineProvider().fetchMarine(points, context);
    expect(Object.keys(result)).toEqual(["fistral"]);
  });

  it("stops the whole batch on an authentication error to avoid wasting accesses", async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ slug: `s${i}`, lat: 50 + i / 10, lon: -5 }));
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ success: false, error: { code: "invalid_client", description: "bad key" }, response: [] }))),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(new XweatherMarineProvider().fetchMarine(many, context)).rejects.toThrow(/invalid_client/);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("fails clearly when credentials are missing", async () => {
    vi.stubEnv("XWEATHER_CLIENT_ID", "");
    vi.stubGlobal("fetch", vi.fn());
    await expect(new XweatherMarineProvider().fetchMarine(points, context)).rejects.toThrow(/XWEATHER_CLIENT_ID/);
  });
});

describe("Xweather weather codes", () => {
  it("converts coded weather to WMO codes", () => {
    expect(xweatherCodeToWmo("::CL")).toBe(0);
    expect(xweatherCodeToWmo("::OV")).toBe(3);
    expect(xweatherCodeToWmo(":L:RW")).toBe(80);
    expect(xweatherCodeToWmo("::T")).toBe(95);
    expect(xweatherCodeToWmo("::F")).toBe(45);
    expect(xweatherCodeToWmo(null)).toBeNull();
  });
});

describe("fallback provider", () => {
  const series = (source: string) => ({
    time: [T0],
    waveHeight: [1],
    waveDirection: [270],
    wavePeriod: [10],
    swellHeight: [1],
    swellDirection: [270],
    swellPeriod: [10],
    secondarySwellHeight: [null],
    secondarySwellDirection: [null],
    secondarySwellPeriod: [null],
    windWaveHeight: [0.2],
    seaSurfaceTemperature: [13],
    seaLevel: [0],
    source,
  });

  it("asks the secondary provider only for spots the primary missed", async () => {
    const primary: MarineProvider = { id: "a", fetchMarine: vi.fn().mockResolvedValue({ fistral: series("A") }) };
    const secondaryFetch = vi.fn().mockResolvedValue({ croyde: series("B") });
    const secondary: MarineProvider = { id: "b", fetchMarine: secondaryFetch };
    const result = await new FallbackMarineProvider(primary, secondary).fetchMarine(points, context);
    expect(result.fistral?.source).toBe("A");
    expect(result.croyde?.source).toBe("B");
    expect(secondaryFetch.mock.calls[0]![0]).toEqual([points[1]]);
  });

  it("uses the secondary for everything when the primary fails", async () => {
    const primary: MarineProvider = { id: "a", fetchMarine: vi.fn().mockRejectedValue(new Error("quota")) };
    const secondary: MarineProvider = {
      id: "b",
      fetchMarine: vi.fn().mockResolvedValue({ fistral: series("B"), croyde: series("B") }),
    };
    const result = await new FallbackMarineProvider(primary, secondary).fetchMarine(points, context);
    expect(Object.keys(result)).toHaveLength(2);
  });

  it("reports the primary error when both fail", async () => {
    const primary: MarineProvider = { id: "a", fetchMarine: vi.fn().mockRejectedValue(new Error("primary down")) };
    const secondary: MarineProvider = { id: "b", fetchMarine: vi.fn().mockRejectedValue(new Error("secondary down")) };
    await expect(new FallbackMarineProvider(primary, secondary).fetchMarine(points, context)).rejects.toThrow("primary down");
  });
});
