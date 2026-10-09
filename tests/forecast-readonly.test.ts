import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.CACHE_DRIVER = "memory";
process.env.FORECAST_DATA_SOURCE = "xweather";

vi.mock("server-only", () => ({}));
const getProviders = vi.fn(() => {
  throw new Error("pages must never call the data providers");
});
vi.mock("@/lib/providers/registry", () => ({ getProviders }));

const { writeCachedBundle } = await import("@/lib/forecast/bundle-cache");
const { loadBundle, resetForecastMemo } = await import("@/lib/forecast/service");
const { latestRefreshSlot } = await import("@/lib/schedule");

const memory = globalThis as typeof globalThis & { __surfMemoryCache?: Map<string, string> };
const NOW = Date.UTC(2026, 9, 9, 12, 0) / 1000;

function bundle(generatedAt: number) {
  return { version: 1, generatedAt, status: "live" as const, nextRefreshAt: generatedAt + 43200, sources: [], errors: [], spots: {} };
}

describe("forecast service is read-only (requirement 1)", () => {
  beforeEach(() => {
    memory.__surfMemoryCache?.clear();
    resetForecastMemo();
    getProviders.mockClear();
  });
  afterAll(() => {
    memory.__surfMemoryCache?.clear();
    resetForecastMemo();
  });

  it("shows unavailable on a cache miss without calling a provider", async () => {
    const result = await loadBundle(NOW);
    expect(result.status).toBe("unavailable");
    expect(getProviders).not.toHaveBeenCalled();
  });

  it("serves an out-of-date cache entry as stale without refreshing", async () => {
    await writeCachedBundle(bundle(latestRefreshSlot(NOW) - 3600));
    const result = await loadBundle(NOW);
    expect(result.status).toBe("stale");
    expect(getProviders).not.toHaveBeenCalled();
  });

  it("serves a fresh cache entry as cached", async () => {
    await writeCachedBundle(bundle(latestRefreshSlot(NOW) + 60));
    expect((await loadBundle(NOW)).status).toBe("cached");
    expect(getProviders).not.toHaveBeenCalled();
  });

  it("does not hammer the cache on repeated misses", async () => {
    await loadBundle(NOW);
    await writeCachedBundle(bundle(latestRefreshSlot(NOW) + 60));
    expect((await loadBundle(NOW + 10)).status).toBe("unavailable"); // memoised for a minute
    expect((await loadBundle(NOW + 120)).status).toBe("cached");
  });
});

/**
 * Static guarantee: nothing reachable from the Next.js app (pages, embeds, OG
 * images, route handlers, next.config) can import the provider registry or the
 * refresh job. Only scripts/refresh.mts may.
 */
describe("import graph (requirement 1)", () => {
  const root = path.resolve(__dirname, "..");
  const forbidden = ["src/lib/providers/registry.ts", "src/lib/forecast/refresh-job.ts"].map((file) => path.join(root, file));

  function resolve(from: string, specifier: string): string | null {
    let base: string;
    if (specifier.startsWith("@/")) base = path.join(root, "src", specifier.slice(2));
    else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
    else return null;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return null;
  }

  function reachable(entries: string[]): Map<string, string> {
    const seen = new Map<string, string>(); // file → importer
    const queue = [...entries];
    for (const entry of entries) seen.set(entry, "(entry)");
    while (queue.length > 0) {
      const file = queue.shift()!;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g)) {
        const target = resolve(file, match[1]!);
        if (target && !seen.has(target)) {
          seen.set(target, file);
          queue.push(target);
        }
      }
    }
    return seen;
  }

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(name) ? [full] : [];
    });
  }

  it("keeps the providers out of every page, route and the build config", () => {
    const entries = [...walk(path.join(root, "src/app")), path.join(root, "next.config.ts"), path.join(root, "src/instrumentation.ts")];
    const graph = reachable(entries);
    for (const file of forbidden) {
      expect(graph.has(file), `${path.relative(root, file)} is imported by ${path.relative(root, graph.get(file) ?? "")}`).toBe(false);
    }
  });

  it("still reaches the providers from the refresh CLI (sanity check of the walker)", () => {
    const graph = reachable([path.join(root, "scripts/refresh.mts")]);
    for (const file of forbidden) expect(graph.has(file)).toBe(true);
  });
});
