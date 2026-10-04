import { env } from "@/lib/env";
import { FileStore } from "./file-store";
import { MemoryStore } from "./memory-store";
import type { CacheStore } from "./types";
import { UpstashStore } from "./upstash-store";

export type { CacheStore } from "./types";

let store: CacheStore | null = null;

export function getCacheStore(): CacheStore {
  if (store) return store;
  const driver = env.cacheDriver;
  if (driver === "upstash" && env.upstashUrl && env.upstashToken) {
    store = new UpstashStore(env.upstashUrl, env.upstashToken);
  } else if (driver === "memory") {
    store = new MemoryStore();
  } else {
    store = new FileStore(env.cacheDir);
  }
  return store;
}
