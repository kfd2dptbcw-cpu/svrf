import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fresh module state per test: the allowance tracker keeps readings in a
 * global so every request in a process shares them.
 */
async function load() {
  vi.resetModules();
  const g = globalThis as Record<string, unknown>;
  delete g.__surfAllowance;
  delete g.__surfMemoryCache;
  vi.stubEnv("CACHE_DRIVER", "memory");
  vi.stubEnv("XWEATHER_CLIENT_ID", "id");
  vi.stubEnv("XWEATHER_CLIENT_SECRET", "secret");
  return import("@/lib/providers/allowance");
}

const NOW = Date.parse("2026-10-15T12:00:00Z") / 1000;

describe("allowance cap", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => undefined));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses reset headers in seconds, milliseconds or as dates", async () => {
    const { parseResetHeader } = await load();
    expect(parseResetHeader("1793491200")).toBe(1793491200);
    expect(parseResetHeader("1793491200000")).toBe(1793491200);
    expect(parseResetHeader("2026-11-01 00:00:00")).toBe(Date.parse("2026-11-01T00:00:00Z") / 1000);
    expect(parseResetHeader(null)).toBeNull();
    expect(parseResetHeader("soon")).toBeNull();
  });

  it("allows refreshes above the floor and warns below the warning level", async () => {
    const { noteAllowance, assertAllowance } = await load();
    noteAllowance("xweather", 5000, null, NOW);
    await expect(assertAllowance("xweather", NOW)).resolves.toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();
    noteAllowance("xweather", 2500, null, NOW);
    await expect(assertAllowance("xweather", NOW)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/allowance low: 2500/));
  });

  it("blocks refreshes below the floor until the period resets", async () => {
    const { noteAllowance, assertAllowance, AllowanceExhaustedError } = await load();
    const resetAt = Date.parse("2026-11-01T00:00:00Z") / 1000;
    noteAllowance("xweather", 900, resetAt, NOW);
    const error = await assertAllowance("xweather", NOW).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AllowanceExhaustedError);
    expect((error as InstanceType<typeof AllowanceExhaustedError>).retryAt).toBe(resetAt);
    await expect(assertAllowance("xweather", resetAt + 1)).resolves.toBeUndefined();
  });

  it("assumes a calendar-month reset when the provider doesn't send one", async () => {
    const { noteAllowance, isBelowFloor, nextMonthStart } = await load();
    noteAllowance("xweather", 10, null, NOW);
    expect(nextMonthStart(NOW)).toBe(Date.parse("2026-11-01T00:00:00Z") / 1000);
    expect(isBelowFloor({ provider: "xweather", remaining: 10, resetAt: null, observedAt: NOW }, NOW)).toBe(true);
    expect(isBelowFloor({ provider: "xweather", remaining: 10, resetAt: null, observedAt: NOW }, nextMonthStart(NOW))).toBe(false);
  });

  it("keeps the lowest reading within a period (responses can arrive out of order)", async () => {
    const { noteAllowance, loadAllowance } = await load();
    noteAllowance("xweather", 4000, 2_000_000_000, NOW);
    noteAllowance("xweather", 4100, 2_000_000_000, NOW + 1);
    expect((await loadAllowance("xweather"))?.remaining).toBe(4000);
  });

  it("shares readings with other instances through the cache store", async () => {
    const { noteAllowance, persistAllowance } = await load();
    noteAllowance("xweather", 800, 2_000_000_000, NOW);
    await persistAllowance("xweather");
    // Simulate another process: memory cleared, shared cache kept.
    delete (globalThis as Record<string, unknown>).__surfAllowance;
    vi.resetModules();
    const fresh = await import("@/lib/providers/allowance");
    await expect(fresh.assertAllowance("xweather", NOW)).rejects.toThrow(/allowance down to 800/);
  });

  it("stops an Xweather batch once a response reports the floor, and skips the next refresh", async () => {
    await load();
    const { XweatherMarineProvider } = await import("@/lib/providers/xweather");
    let remaining = 1003;
    const fetchMock = vi.fn().mockImplementation(() => {
      remaining -= 1;
      return Promise.resolve(
        new Response(
          JSON.stringify({ success: true, error: null, response: [{ periods: [{ timestamp: 1_791_158_400, swellHeightM: 1 }] }] }),
          { headers: { "X-RateLimit-Remaining-Period": String(remaining), "X-Cost-Tokens": "1" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const points = Array.from({ length: 20 }, (_, i) => ({ slug: `s${i}`, lat: 50 + i / 10, lon: -5 }));
    await expect(new XweatherMarineProvider().fetchMarine(points, { days: 1 })).rejects.toThrow(/allowance down to/);
    const calls = fetchMock.mock.calls.length;
    expect(calls).toBeLessThan(10);
    await expect(new XweatherMarineProvider().fetchMarine(points, { days: 1 })).rejects.toThrow(/allowance down to/);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});
