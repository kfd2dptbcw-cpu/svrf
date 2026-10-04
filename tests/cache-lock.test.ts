import { mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileStore } from "@/lib/cache/file-store";
import { MemoryStore } from "@/lib/cache/memory-store";

describe("refresh locks", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "surf-cache-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("lets only one file-store holder in at a time", async () => {
    const a = new FileStore(dir);
    const b = new FileStore(dir);
    expect(await a.acquireLock("bundle", 60)).toBe(true);
    expect(await b.acquireLock("bundle", 60)).toBe(false);
    await a.releaseLock("bundle");
    expect(await b.acquireLock("bundle", 60)).toBe(true);
  });

  it("breaks stale file locks left by crashed processes", async () => {
    const store = new FileStore(dir);
    expect(await store.acquireLock("bundle", 60)).toBe(true);
    const old = new Date(Date.now() - 120_000);
    await utimes(path.join(dir, "bundle.cache.lock"), old, old);
    expect(await new FileStore(dir).acquireLock("bundle", 60)).toBe(true);
  });

  it("expires memory locks after their TTL", async () => {
    const store = new MemoryStore();
    expect(await store.acquireLock("k", 0.05)).toBe(true);
    expect(await store.acquireLock("k", 0.05)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(await store.acquireLock("k", 0.05)).toBe(true);
    await store.releaseLock("k");
  });
});
