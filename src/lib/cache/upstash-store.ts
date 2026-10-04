import { fetchJson } from "@/lib/http/fetch-json";
import type { CacheStore } from "./types";

/**
 * Upstash Redis via its REST API (free tier available). Recommended for
 * serverless hosting so every instance shares one forecast cache and the
 * upstream APIs are only called at the scheduled refresh times.
 */
export class UpstashStore implements CacheStore {
  readonly name = "upstash";

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async get(key: string) {
    const data = await fetchJson<{ result: string | null }>(`${this.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      label: "Upstash",
      retries: 1,
      timeoutMs: 5000,
    });
    return data.result;
  }

  async set(key: string, value: string) {
    const response = await fetch(`${this.url}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: value,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Upstash SET failed with ${response.status}`);
  }

  /** SET key NX EX ttl — atomic across every instance sharing the database. */
  async acquireLock(key: string, ttlSeconds: number) {
    const data = await fetchJson<{ result: string | null }>(
      `${this.url}/set/${encodeURIComponent(`${key}:lock`)}/1/NX/EX/${ttlSeconds}`,
      { headers: { Authorization: `Bearer ${this.token}` }, label: "Upstash", retries: 1, timeoutMs: 5000 },
    );
    return data.result === "OK";
  }

  async releaseLock(key: string) {
    await fetch(`${this.url}/del/${encodeURIComponent(`${key}:lock`)}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);
  }
}
