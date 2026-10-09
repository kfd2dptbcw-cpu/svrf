import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const empty = { version: 1, generatedAt: 0, status: "unavailable", nextRefreshAt: 0, sources: [], errors: [], spots: {} };
vi.mock("@/lib/forecast/service", () => ({
  getForecastBundle: async () => empty,
  getSpotForecast: async () => ({ bundle: empty, forecast: null }),
}));

const { spots } = await import("@/lib/config");
const { measureEmbed } = await import("@/components/embed/ResizeReporter");
const pages = {
  top: (await import("@/app/(embed)/embed/page")).default,
  region: (await import("@/app/(embed)/embed/[region]/page")).default,
  spot: (await import("@/app/(embed)/embed/[region]/[spot]/page")).default,
};

describe("embed widgets with no forecast (requirement 5)", () => {
  const spot = spots[0]!;

  it.each([
    ["top", () => pages.top()],
    ["region", () => pages.region({ params: Promise.resolve({ region: spot.region }) })],
    ["spot", () => pages.spot({ params: Promise.resolve({ region: spot.region, spot: spot.slug }) })],
  ])("%s widget renders only the empty marker, not an 'unavailable' message", async (_name, render) => {
    const html = renderToStaticMarkup(await render());
    expect(html).toContain("data-surf-empty");
    expect(html).not.toMatch(/unavailable/i);
    expect(html).not.toContain("<h1");
  });

  it("reports height 0 to the host page when the widget is empty", () => {
    const doc = (marker: boolean) => ({
      querySelector: (selector: string) => (marker && selector === "[data-surf-empty]" ? ({} as Element) : null),
      documentElement: { scrollHeight: 412 } as HTMLElement,
    });
    expect(measureEmbed(doc(true))).toEqual({ height: 0, empty: true });
    expect(measureEmbed(doc(false))).toEqual({ height: 412, empty: false });
  });
});

describe("embed.js (requirement 5)", () => {
  function load() {
    const origin = "https://surf.example.com";
    const attributes = new Map<string, string>([["data-surf-forecast", "/embed/cornwall/fistral"]]);
    const placeholder = {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => void attributes.set(name, value),
      removeAttribute: (name: string) => void attributes.delete(name),
      appendChild: (child: unknown) => void (iframe = child as typeof iframe),
    };
    let iframe = { style: {} as Record<string, string>, contentWindow: {} };
    let listener: ((event: unknown) => void) | undefined;
    const context = {
      URL,
      document: {
        currentScript: { src: `${origin}/embed.js` },
        createElement: () => ({ style: {}, contentWindow: {} }),
        querySelectorAll: () => [placeholder],
      },
      window: {
        location: { origin },
        addEventListener: (_type: string, handler: (event: unknown) => void) => void (listener = handler),
      },
    };
    vm.runInNewContext(readFileSync(path.join(__dirname, "../public/embed.js"), "utf8"), context);
    const post = (data: unknown) => listener!({ origin, source: iframe.contentWindow, data });
    return { attributes, frame: () => iframe, post };
  }

  it("collapses the iframe and marks the placeholder when the widget is empty", () => {
    const { attributes, frame, post } = load();
    expect(frame().style.height).toBe("360px");
    post({ type: "uk-surf-forecast:resize", height: 0, empty: true });
    expect(frame().style.height).toBe("0px");
    expect(attributes.has("data-surf-empty")).toBe(true);
  });

  it("restores the placeholder once a forecast arrives", () => {
    const { attributes, frame, post } = load();
    post({ type: "uk-surf-forecast:resize", height: 0, empty: true });
    post({ type: "uk-surf-forecast:resize", height: 300.4, empty: false });
    expect(frame().style.height).toBe("301px");
    expect(attributes.has("data-surf-empty")).toBe(false);
  });
});
