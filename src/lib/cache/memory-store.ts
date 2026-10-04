import type { CacheStore } from "./types";

const globalStore = globalThis as typeof globalThis & { __surfMemoryCache?: Map<string, string> };

/** In-process store. Survives hot reloads in development; not shared between instances. */
export class MemoryStore implements CacheStore {
  readonly name = "memory";
  private readonly map = (globalStore.__surfMemoryCache ??= new Map<string, string>());

  async get(key: string) {
    return this.map.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.map.set(key, value);
  }
}
