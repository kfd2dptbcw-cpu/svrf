import { gunzipSync, gzipSync } from "node:zlib";
import { spots } from "@/lib/config";
import { getCacheStore } from "@/lib/cache";
import { env } from "@/lib/env";
import type { ForecastBundle } from "@/types/forecast";

/**
 * Reading and writing the processed forecast bundle in the shared cache store.
 * Used by the read-only page path (service.ts) and by the refresh job.
 */

export const BUNDLE_VERSION = 1;

export function bundleKey() {
  return `forecast-bundle-v${BUNDLE_VERSION}-${env.dataSource}`;
}

/** Hash of the spot configuration so edits to config/spots.json mark the cache as not fresh. */
export const configHash = (() => {
  const text = JSON.stringify(spots);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
})();

interface StoredBundle {
  configHash: string;
  bundle: ForecastBundle;
}

export async function readCachedBundle(): Promise<{ bundle: ForecastBundle; configMatches: boolean } | null> {
  try {
    const raw = await getCacheStore().get(bundleKey());
    if (!raw) return null;
    const stored = JSON.parse(gunzipSync(Buffer.from(raw, "base64")).toString("utf8")) as StoredBundle;
    if (stored.bundle?.version !== BUNDLE_VERSION) return null;
    return { bundle: stored.bundle, configMatches: stored.configHash === configHash };
  } catch (error) {
    console.error(`[forecast] cache read failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** Throws on failure: the refresh job must know if its result wasn't saved. */
export async function writeCachedBundle(bundle: ForecastBundle) {
  const payload: StoredBundle = { configHash, bundle };
  await getCacheStore().set(bundleKey(), gzipSync(JSON.stringify(payload)).toString("base64"));
}
