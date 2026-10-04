import type { CacheStore } from "./types";

const globalStore = globalThis as typeof globalThis & {
  __surfMemoryCache?: Map<string, string>;
  __surfMemoryLocks?: Map<string, number>;
};

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

  private readonly locks = (globalStore.__surfMemoryLocks ??= new Map<string, number>());

  async acquireLock(key: string, ttlSeconds: number) {
    const now = Date.now();
    const expiry = this.locks.get(key);
    if (expiry !== undefined && expiry > now) return false;
    this.locks.set(key, now + ttlSeconds * 1000);
    return true;
  }

  async releaseLock(key: string) {
    this.locks.delete(key);
  }
}
