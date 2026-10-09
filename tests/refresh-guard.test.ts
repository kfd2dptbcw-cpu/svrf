import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.CACHE_DRIVER = "memory";
process.env.FORECAST_DATA_SOURCE = "xweather";

const fetchMarine = vi.fn();
vi.mock("@/lib/providers/registry", () => ({
  getProviders: () => ({
    marine: { fetchMarine },
    weather: { fetchWeather: async () => ({}) },
    tide: { fetchTides: async () => ({}) },
    isSample: false,
  }),
}));

const { MemoryStore } = await import("@/lib/cache/memory-store");
const guard = await import("@/lib/forecast/refresh-guard");
const { runRefresh } = await import("@/lib/forecast/refresh-job");
const { recordCost } = await import("@/lib/providers/usage");

const memory = globalThis as typeof globalThis & { __surfMemoryCache?: Map<string, string>; __surfMemoryLocks?: Map<string, number> };
const HOUR = 3600;

function charge(tokens: number) {
  recordCost({ provider: "xweather", endpoint: "maritime", tokens, multipliers: null, remainingPeriod: null });
}

describe("refresh loop guard (requirement 3)", () => {
  beforeEach(() => {
    memory.__surfMemoryCache?.clear();
    memory.__surfMemoryLocks?.clear();
    fetchMarine.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("writes last-refresh-attempt and refuses another attempt within 3 hours", async () => {
    const store = new MemoryStore();
    const t0 = 1_800_000_000;
    await guard.claimRefreshAttempt({ now: t0, store });
    expect(await guard.readLastAttempt(store)).toEqual({ at: t0, forced: false });
    await expect(guard.claimRefreshAttempt({ now: t0 + 3 * HOUR - 1, store })).rejects.toBeInstanceOf(guard.RefreshTooSoonError);
    await expect(guard.claimRefreshAttempt({ now: t0 + 3 * HOUR, store })).resolves.toMatchObject({ at: t0 + 3 * HOUR });
  });

  it("lets --force override the guard", async () => {
    const store = new MemoryStore();
    await guard.claimRefreshAttempt({ now: 1000, store });
    await expect(guard.claimRefreshAttempt({ now: 1001, store, force: true })).resolves.toEqual({ at: 1001, forced: true });
  });

  it("blocks the retry after a FAILED attempt and records the accesses it spent", async () => {
    fetchMarine.mockImplementation(async () => {
      charge(120); // charged by the provider before the refresh died
      throw new Error("upstream timeout");
    });
    await expect(runRefresh()).rejects.toThrow("upstream timeout");
    await expect(runRefresh()).rejects.toBeInstanceOf(guard.RefreshTooSoonError);
    expect(fetchMarine).toHaveBeenCalledTimes(1);

    const log = await guard.readUsageLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ accesses: 120, ok: false, error: "upstream timeout" });
    expect(await guard.accessesLast24h()).toBe(120);
  });

  it("blocks the retry after an attempt that never finished (process killed)", async () => {
    // A killed run leaves only its attempt marker behind.
    await guard.claimRefreshAttempt();
    await expect(runRefresh()).rejects.toBeInstanceOf(guard.RefreshTooSoonError);
    expect(fetchMarine).not.toHaveBeenCalled();
  });

  it("refuses to start if the guard cannot be read", async () => {
    vi.spyOn(MemoryStore.prototype, "get").mockRejectedValue(new Error("Upstash down"));
    await expect(runRefresh()).rejects.toThrow("Upstash down");
    expect(fetchMarine).not.toHaveBeenCalled();
  });
});

describe("access ledger (requirement 4)", () => {
  beforeEach(() => memory.__surfMemoryCache?.clear());
  afterEach(() => vi.restoreAllMocks());

  it("sums only the last 24 hours and warns loudly above 300", async () => {
    const store = new MemoryStore();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const now = 2_000_000_000;
    await guard.recordRefreshUsage({ at: now - 25 * HOUR, accesses: 1000, ok: true }, { now, store });
    expect(error).not.toHaveBeenCalled();
    expect(await guard.recordRefreshUsage({ at: now - HOUR, accesses: 200, ok: false }, { now, store })).toBe(200);
    expect(error).not.toHaveBeenCalled();
    expect(await guard.recordRefreshUsage({ at: now, accesses: 150, ok: true }, { now, store })).toBe(350);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("WARNING"));
    expect(await guard.accessesLast24h(now, store)).toBe(350);
  });
});
