import { describe, expect, it } from "vitest";
import { spots } from "@/lib/config";
import { buildSpotForecast, toEngineSpot } from "@/lib/forecast/engine";
import { formatSurfRange } from "@/lib/format";
import { SampleMarineProvider, SampleTideProvider, SampleWeatherProvider } from "@/lib/providers/sample";

/**
 * End-to-end engine test using the clearly-labelled synthetic sample
 * providers (no network access required).
 */
describe("forecast engine end to end", () => {
  it("builds complete 7-day forecasts for every spot", async () => {
    const points = spots.map((spot) => ({ slug: spot.slug, lat: spot.marinePoint.lat, lon: spot.marinePoint.lon }));
    const context = { days: 7 };
    const marine = await new SampleMarineProvider().fetchMarine(points, context);
    const weather = await new SampleWeatherProvider().fetchWeather(points, context);
    const tides = await new SampleTideProvider().fetchTides(points, { ...context, marine });

    for (const spot of spots) {
      const forecast = buildSpotForecast(
        spot.slug,
        toEngineSpot(spot),
        { marine: marine[spot.slug]!, weather: weather[spot.slug]!, tide: tides[spot.slug]! },
        1,
      );
      expect(forecast.hasMarineData).toBe(true);
      expect(forecast.days.length).toBeGreaterThanOrEqual(6);
      for (const day of forecast.days) {
        expect(day.rating).toBeGreaterThanOrEqual(1);
        expect(day.rating).toBeLessThanOrEqual(5);
        expect(day.summary.length).toBeGreaterThanOrEqual(2);
        if (day.surfMaxFt > 0) expect(day.summary[0]).toContain(formatSurfRange(day.surfMinFt, day.surfMaxFt));
        if (day.surfMaxFt <= 1) expect(day.rating).toBe(1);
        expect(day.tideEvents.length).toBeGreaterThanOrEqual(2);
        expect(Object.keys(day.suitability)).toEqual(["beginner", "intermediate", "advanced"]);
        if (day.bestWindow) {
          expect(day.bestWindow.end).toBeGreaterThan(day.bestWindow.start);
          expect(day.summary.at(-1)).toMatch(/^Best between/);
        }
      }
    }
  });
});
