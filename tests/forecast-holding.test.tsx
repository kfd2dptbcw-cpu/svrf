import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ForecastBundle } from "@/types/forecast";

let bundle: ForecastBundle;
vi.mock("@/lib/forecast/service", () => ({
  getForecastBundle: async () => bundle,
  getSpotForecast: async (slug: string) => ({ bundle, forecast: bundle.spots[slug] ?? null }),
}));
// Client-only widgets that don't matter here.
vi.mock("@/components/map/MapSection", () => ({ MapSection: () => null }));
vi.mock("@/components/explorer/SpotExplorer", () => ({ SpotExplorer: () => <div data-explorer="" /> }));
vi.mock("@/components/favourites/FavouriteButton", () => ({ FavouriteButton: () => null }));

const { spots, getRegion } = await import("@/lib/config");
const { ForecastHolding, HOLDING_LINKS } = await import("@/components/forecast/ForecastHolding");
const spot = spots[0]!;
const region = getRegion(spot.region)!;

const pages: [string, () => Promise<React.ReactElement>][] = [
  ["/", async () => (await import("@/app/(site)/page")).default()],
  ["/today", async () => (await import("@/app/(site)/today/page")).default()],
  ["/tomorrow", async () => (await import("@/app/(site)/tomorrow/page")).default()],
  ["/7-day", async () => (await import("@/app/(site)/7-day/page")).default()],
  ["/spots", async () => (await import("@/app/(site)/spots/page")).default()],
  ["/regions", async () => (await import("@/app/(site)/regions/page")).default()],
  ["/surf/[region]", async () => (await import("@/app/(site)/surf/[region]/page")).default({ params: Promise.resolve({ region: region.slug }) })],
  [
    "/surf/[region]/[spot]",
    async () => (await import("@/app/(site)/surf/[region]/[spot]/page")).default({ params: Promise.resolve({ region: region.slug, spot: spot.slug }) }),
  ],
];

const render = async (page: () => Promise<React.ReactElement>) => renderToStaticMarkup(await page());
// React escapes apostrophes in text.
const text = (html: string) => html.replace(/&#x27;/g, "'");

function base(status: ForecastBundle["status"]): ForecastBundle {
  return { version: 1, generatedAt: status === "unavailable" ? 0 : 1_790_000_000, status, nextRefreshAt: 0, sources: [], errors: [], spots: {} };
}

describe("forecast holding message (main site, status unavailable)", () => {
  beforeEach(() => {
    bundle = base("unavailable");
  });

  it.each(pages)("%s shows the holding block instead of 'unavailable'", async (_path, page) => {
    const html = text(await render(page));
    expect(html).toContain("data-forecast-holding");
    expect(html).toContain("FORECAST · OFF THE BOIL");
    expect(html).toContain("The forecast's having a lie-in.");
    expect(html).toContain("there's nothing honest to show you right now");
    for (const link of HOLDING_LINKS) expect(html).toContain(`href="${link.href}"`);
    expect(html).not.toMatch(/temporarily unavailable/i);
    expect(html.match(/data-forecast-holding/g)).toHaveLength(1);
  });

  it("keeps the spot page's real content", async () => {
    const html = text(await render(pages[7]![1]));
    expect(html).toContain(`${spot.name} surf forecast`);
    expect(html).toContain(text(renderToStaticMarkup(<>{spot.description}</>)));
    expect(html).toContain(`aria-label="Breadcrumb"`);
    expect(html).toContain(region.name);
    expect(html).toContain(`About ${spot.name}`);
    expect(html).not.toContain("Day by day");
    expect(html).not.toContain("7-day forecast");
  });

  it("lists the region's spots on a region page", async () => {
    const html = await render(pages[6]![1]);
    expect(html).toContain(`href="${spot.path}"`);
  });

  it("uses no exclamation marks", () => {
    expect(renderToStaticMarkup(<ForecastHolding />)).not.toContain("!");
  });
});

describe("pages with forecast data never show the holding block", () => {
  it.each(pages)("%s (stale)", async (_path, page) => {
    bundle = base("stale");
    expect(await render(page)).not.toContain("data-forecast-holding");
  });
});
