import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, HttpError } from "@/lib/http/fetch-json";

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
}

describe("fetchJson", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns parsed JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { ok: true })));
    await expect(fetchJson("https://example.test/a", { retries: 0 })).resolves.toEqual({ ok: true });
  });

  it("retries transient server errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(503, "busy"))
      .mockResolvedValueOnce(response(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJson("https://example.test/b", { retries: 1 })).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry client errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(400, { reason: "bad" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJson("https://example.test/c", { retries: 3 })).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up immediately on long rate-limit windows and reports Retry-After", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(429, "slow down", { "retry-after": "3600" }));
    vi.stubGlobal("fetch", fetchMock);
    const error = await fetchJson("https://example.test/d", { retries: 3 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).isRateLimit).toBe(true);
    expect((error as HttpError).retryAfter).toBe(3600);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports network failures after exhausting retries", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJson("https://example.test/e", { retries: 1, label: "Test API" })).rejects.toThrow(/Test API is unreachable/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("times out slow requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })),
    );
    await expect(fetchJson("https://example.test/f", { retries: 0, timeoutMs: 20, label: "Slow API" })).rejects.toThrow(/timed out/);
  });
});
