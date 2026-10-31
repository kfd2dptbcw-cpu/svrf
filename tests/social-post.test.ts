import { describe, expect, it, vi } from "vitest";
import { buildCaption, pickFeaturedSpots, postingActive, socialCardPath } from "@/lib/social/daily-post";
import { postFacebookPhoto, postInstagramImage, type MetaConfig } from "@/lib/social/meta";
import type { DayForecast, ForecastBundle, StarRating } from "@/types/forecast";

const DATE = "2026-11-03";

function day(score: number, rating: StarRating, maxFt: number): DayForecast {
  return {
    date: DATE,
    sunrise: null,
    sunset: null,
    score,
    rating,
    label: (["Poor", "Fair", "Good", "Excellent", "Epic"] as const)[rating - 1]!,
    surfMinFt: Math.max(0, maxFt - 1),
    surfMaxFt: maxFt,
    primarySwell: null,
    wind: { speedKmh: 10, gustKmh: null, directionDeg: 90, type: "offshore" },
    airTempMinC: null,
    airTempMaxC: null,
    seaTempC: null,
    weatherCode: null,
    tideEvents: [],
    bestWindow: null,
    suitability: {
      beginner: { level: "good", reason: "" },
      intermediate: { level: "good", reason: "" },
      advanced: { level: "good", reason: "" },
    },
    summary: [],
  } as DayForecast;
}

function bundle(days: Record<string, DayForecast>): ForecastBundle {
  const spots = Object.fromEntries(
    Object.entries(days).map(([slug, d]) => [slug, { slug, generatedAt: 0, hasMarineData: true, days: [d], hourly: [], sources: [] }]),
  );
  return { spots } as unknown as ForecastBundle;
}

describe("pickFeaturedSpots", () => {
  it("takes the best spot from each region before a second from the same region", () => {
    const picks = pickFeaturedSpots(
      bundle({
        fistral: day(90, 5, 5),
        sennen: day(85, 4, 4),
        croyde: day(70, 4, 4),
        thurso: day(10, 1, 1),
        "thurso-east": day(60, 3, 3),
      }),
      DATE,
    );
    expect(picks.map((p) => p.spot.slug)).toEqual(["fistral", "croyde", "thurso-east"]);
    expect(picks[0]!.regionName).toBe("Cornwall");
  });

  it("tops up from the same region and never features flat spots", () => {
    const picks = pickFeaturedSpots(bundle({ fistral: day(90, 5, 5), sennen: day(85, 4, 4), croyde: day(5, 1, 0) }), DATE);
    expect(picks.map((p) => p.spot.slug)).toEqual(["fistral", "sennen"]);
  });
});

describe("buildCaption", () => {
  const picks = pickFeaturedSpots(bundle({ fistral: day(90, 4, 5) }), DATE);

  it("links to the site on Facebook", () => {
    const caption = buildCaption(picks, DATE, "https://forecast.svrf.uk", "facebook");
    expect(caption).toContain("Tuesday 3 November");
    expect(caption).toContain("1. Fistral Beach, Cornwall: ★★★★☆ Excellent");
    expect(caption).toContain("4-5ft · Offshore");
    expect(caption).toContain("https://forecast.svrf.uk/today?utm_source=facebook");
  });

  it("points to the link in bio on Instagram, where captions can't hold links", () => {
    const caption = buildCaption(picks, DATE, "https://forecast.svrf.uk", "instagram");
    expect(caption).not.toContain("https://");
    expect(caption).toContain("link in bio");
    expect(caption).toContain("#surf");
  });
});

describe("posting schedule", () => {
  it("starts on 3 November 2026", () => {
    expect(postingActive("2026-11-02")).toBe(false);
    expect(postingActive("2026-11-03")).toBe(true);
    expect(postingActive("2027-01-01")).toBe(true);
    expect(postingActive("2026-11-03", "2026-12-01")).toBe(false);
  });

  it("serves the card as JPEG for Instagram", () => {
    expect(socialCardPath(DATE)).toBe("/api/social-card?date=2026-11-03&format=jpeg");
  });
});

describe("Meta client", () => {
  const config: MetaConfig = { pageId: "123", pageAccessToken: "secret-token", instagramUserId: "456", graphVersion: "v23.0" };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("posts a photo to the Facebook Page", async () => {
    const fetchImpl = vi.fn<(...args: unknown[]) => Promise<Response>>(async () => json({ id: "photo1", post_id: "123_post1" }));
    await expect(postFacebookPhoto(config, "https://x/card.jpg", "hi", fetchImpl as typeof fetch)).resolves.toBe("123_post1");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://graph.facebook.com/v23.0/123/photos");
    expect(String(init.body)).toContain("url=https%3A%2F%2Fx%2Fcard.jpg");
  });

  it("creates, waits for and publishes an Instagram container", async () => {
    const responses = [json({ id: "c1" }), json({ status_code: "IN_PROGRESS" }), json({ status_code: "FINISHED" }), json({ id: "m1" })];
    const fetchImpl = vi.fn<(...args: unknown[]) => Promise<Response>>(async () => responses.shift()!);
    await expect(postInstagramImage(config, "https://x/card.jpg", "hi", { fetchImpl: fetchImpl as typeof fetch, pollMs: 0 })).resolves.toBe("m1");
    expect(String(fetchImpl.mock.calls[3]![0])).toContain("/456/media_publish");
  });

  it("reports Meta's error without leaking the token", async () => {
    const fetchImpl = vi.fn(async () => json({ error: { message: "Invalid OAuth access token" } }, 400));
    const error = await postFacebookPhoto(config, "https://x/card.jpg", "hi", fetchImpl as typeof fetch).then(
      () => new Error("expected a failure"),
      (e: Error) => e,
    );
    expect(error.message).toContain("Invalid OAuth access token");
    expect(error.message).not.toContain("secret-token");
  });
});
