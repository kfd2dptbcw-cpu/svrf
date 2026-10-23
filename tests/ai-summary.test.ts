import { describe, expect, it, vi } from "vitest";

import { addAiSummaries, describeDayFacts, isGroundedSummary, requestSpotSummaries } from "@/lib/forecast/ai-summary";
import type { DayForecast, SpotForecast } from "@/types/forecast";

function makeDay(date: string): DayForecast {
  return {
    date,
    sunrise: null,
    sunset: null,
    score: 6,
    rating: 3,
    label: "Good",
    surfMinFt: 3,
    surfMaxFt: 4,
    primarySwell: { heightM: 1.2, periodS: 11, directionDeg: 280 },
    wind: { speedKmh: 12, gustKmh: 20, directionDeg: 90, type: "offshore" },
    airTempMinC: 8,
    airTempMaxC: 12,
    seaTempC: 13,
    weatherCode: 1,
    tideEvents: [],
    bestWindow: null,
    suitability: {
      beginner: { level: "marginal", reason: "a bit steep" },
      intermediate: { level: "ideal", reason: "clean and sized" },
      advanced: { level: "good", reason: "fun" },
    },
    summary: ["3-4ft clean surf."],
  };
}

function forecastFor(slug: string, dates: string[]): SpotForecast {
  return { slug, generatedAt: 0, hasMarineData: true, days: dates.map(makeDay), hourly: [], sources: [] };
}

function reply(days: Record<string, string>) {
  return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ days }) }] }), { status: 200 });
}

describe("grounding check", () => {
  const facts = describeDayFacts(makeDay("2026-10-24"));

  it("accepts text whose numbers all come from the facts", () => {
    expect(isGroundedSummary("Clean 3-4ft surf with an offshore breeze and a 13°C sea.", facts)).toBe(true);
  });

  it("rejects invented numbers", () => {
    expect(isGroundedSummary("Clean 6-8ft surf with an offshore breeze today.", facts)).toBe(false);
  });

  it("rejects a real number reused with the wrong unit", () => {
    // 20 is in the facts (gusts of 20 km/h) but not as feet of surf.
    expect(isGroundedSummary("Big 20ft surf with an offshore breeze today.", facts)).toBe(false);
  });

  it("rejects text that is too short or too long", () => {
    expect(isGroundedSummary("Fine.", facts)).toBe(false);
    expect(isGroundedSummary("x".repeat(500), facts)).toBe(false);
  });
});

describe("requestSpotSummaries", () => {
  it("keeps valid summaries and drops invalid ones", async () => {
    const fetchImpl = vi.fn(async () =>
      reply({
        "2026-10-24": "Clean 3-4ft surf with an offshore breeze. Suits intermediates best.",
        "2026-10-25": "Huge 20ft surf with an offshore breeze. Suits everyone, honestly.",
      }),
    ) as unknown as typeof fetch;
    const out = await requestSpotSummaries("Fistral", [makeDay("2026-10-24"), makeDay("2026-10-25")], { apiKey: "k", model: "m", fetchImpl });
    expect(Object.keys(out)).toEqual(["2026-10-24"]);
  });
});

describe("addAiSummaries", () => {
  it("does nothing without an API key", async () => {
    const forecasts = { a: forecastFor("a", ["2026-10-24"]) };
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await addAiSummaries(forecasts, { a: "A" }, { apiKey: null, fetchImpl });
    expect(result).toEqual({ added: 0, errors: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(forecasts.a.days[0]!.aiSummary).toBeUndefined();
  });

  it("sets aiSummary on success and keeps going when one spot fails", async () => {
    const forecasts = { a: forecastFor("a", ["2026-10-24"]), b: forecastFor("b", ["2026-10-24"]) };
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls === 2) return new Response("nope", { status: 500 });
      return reply({ "2026-10-24": "Clean 3-4ft surf with an offshore breeze. Suits intermediates best." });
    }) as unknown as typeof fetch;
    const result = await addAiSummaries(forecasts, { a: "A", b: "B" }, { apiKey: "k", model: "m", fetchImpl });
    expect(result.added).toBe(1);
    expect(result.errors).toHaveLength(1);
    const summarised = Object.values(forecasts).filter((f) => f.days[0]!.aiSummary);
    expect(summarised).toHaveLength(1);
  });
});
