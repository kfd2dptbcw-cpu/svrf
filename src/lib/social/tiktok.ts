/**
 * Minimal TikTok Content Posting API client for the daily social post.
 *
 *   Token refresh:  POST /v2/oauth/token/                       (refresh_token → access_token, ~24 h)
 *   Photo post:     POST /v2/post/publish/content/init/         (PULL_FROM_URL, Direct Post)
 *   Status:         POST /v2/post/publish/status/fetch/         (publish_id)
 *
 * TikTok pulls the image from our public URL, so the site's domain must be
 * verified in the TikTok developer portal. Until the app passes TikTok's
 * audit, posts can only be PRIVATE (SELF_ONLY): TIKTOK_PRIVACY_LEVEL defaults
 * to that and is switched to PUBLIC_TO_EVERYONE once the app is approved.
 */
import { createHash } from "node:crypto";
import type { CacheStore } from "@/lib/cache";

const API = "https://open.tiktokapis.com";
export const REFRESH_TOKEN_KEY = "tiktok-refresh-token";

export const PRIVACY_LEVELS = ["SELF_ONLY", "FOLLOWER_OF_CREATOR", "MUTUAL_FOLLOW_FRIENDS", "PUBLIC_TO_EVERYONE"] as const;
export type PrivacyLevel = (typeof PRIVACY_LEVELS)[number];

export interface TikTokConfig {
  clientKey: string;
  clientSecret: string;
  /** Refresh token from `npm run tiktok:auth`, stored as a GitHub secret. */
  refreshToken: string;
  privacyLevel: PrivacyLevel;
}

type Fetch = typeof fetch;

export class TikTokApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "TikTokApiError";
  }
}

/** Parse TIKTOK_PRIVACY_LEVEL; anything unknown falls back to the safe private level. */
export function parsePrivacyLevel(value: string | null | undefined): PrivacyLevel {
  const upper = value?.trim().toUpperCase();
  return (PRIVACY_LEVELS as readonly string[]).includes(upper ?? "") ? (upper as PrivacyLevel) : "SELF_ONLY";
}

async function call<T>(path: string, init: RequestInit, fetchImpl: Fetch): Promise<T> {
  const response = await fetchImpl(`${API}${path}`, { ...init, signal: AbortSignal.timeout(60_000) });
  const json = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string };
    error_description?: string;
  };
  // TikTok returns error.code === "ok" on success, even on some failures' envelopes.
  const code = json.error?.code;
  if (!response.ok || (code && code !== "ok")) {
    // Never echo secrets or tokens: only TikTok's own error text goes into logs.
    const message = json.error?.message ?? json.error_description ?? response.statusText;
    throw new TikTokApiError(`TikTok ${path}: ${code ? `${code}: ` : ""}${message}`, response.status, code);
  }
  return json;
}

const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

interface StoredToken {
  token: string;
  /** Fingerprint of the secret this chain started from, so a re-authorised secret replaces the stored chain. */
  seed: string;
}

/**
 * TikTok may rotate the refresh token on every refresh. The newest one is kept
 * in the shared store; the GitHub secret is only the seed. If the secret
 * changes (you re-authorised), the new secret wins.
 */
async function currentRefreshToken(config: TikTokConfig, store: CacheStore): Promise<string> {
  try {
    const raw = await store.get(REFRESH_TOKEN_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<StoredToken>) : null;
    if (stored?.token && stored.seed === fingerprint(config.refreshToken)) return stored.token;
  } catch {
    // Unreadable record: fall back to the secret.
  }
  return config.refreshToken;
}

/** Exchange the refresh token for a short-lived access token, remembering any rotated refresh token. */
export async function getAccessToken(config: TikTokConfig, store: CacheStore, fetchImpl: Fetch = fetch): Promise<string> {
  const refreshToken = await currentRefreshToken(config, store);
  const result = await call<{ access_token?: string; refresh_token?: string }>(
    "/v2/oauth/token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body: new URLSearchParams({
        client_key: config.clientKey,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    },
    fetchImpl,
  );
  if (!result.access_token) throw new TikTokApiError("TikTok /v2/oauth/token/: no access_token in the response", 502);
  if (result.refresh_token && result.refresh_token !== refreshToken) {
    const record: StoredToken = { token: result.refresh_token, seed: fingerprint(config.refreshToken) };
    await store.set(REFRESH_TOKEN_KEY, JSON.stringify(record));
  }
  return result.access_token;
}

/** TikTok photo posts take a short title (90 chars max) and a longer description (4000 max). */
export function splitTikTokCaption(caption: string): { title: string; description: string } {
  const [first = "", ...rest] = caption.split("\n\n");
  const title = [...first].slice(0, 90).join("");
  return { title, description: [...rest.join("\n\n")].slice(0, 4000).join("") };
}

/** Post one photo (Direct Post). Returns the publish id. */
export async function postTikTokPhoto(
  config: TikTokConfig,
  accessToken: string,
  imageUrl: string,
  caption: string,
  fetchImpl: Fetch = fetch,
) {
  const { title, description } = splitTikTokCaption(caption);
  const result = await call<{ data?: { publish_id?: string } }>(
    "/v2/post/publish/content/init/",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        media_type: "PHOTO",
        post_mode: "DIRECT_POST",
        post_info: {
          title,
          description,
          privacy_level: config.privacyLevel,
          disable_comment: false,
          auto_add_music: true,
        },
        source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: [imageUrl] },
      }),
    },
    fetchImpl,
  );
  const id = result.data?.publish_id;
  if (!id) throw new TikTokApiError("TikTok /v2/post/publish/content/init/: no publish_id in the response", 502);
  return id;
}

/** Wait for TikTok to finish processing the post. Throws if it fails; returns the final status. */
export async function waitForPublish(
  accessToken: string,
  publishId: string,
  { fetchImpl = fetch, pollMs = 3000, maxPolls = 20 }: { fetchImpl?: Fetch; pollMs?: number; maxPolls?: number } = {},
) {
  let status = "PROCESSING";
  for (let attempt = 0; attempt < maxPolls; attempt++) {
    const result = await call<{ data?: { status?: string; fail_reason?: string } }>(
      "/v2/post/publish/status/fetch/",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ publish_id: publishId }),
      },
      fetchImpl,
    );
    status = result.data?.status ?? status;
    if (status === "PUBLISH_COMPLETE") return status;
    if (status === "FAILED") throw new TikTokApiError(`TikTok post failed: ${result.data?.fail_reason ?? "unknown reason"}`, 500);
    if (attempt < maxPolls - 1) await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return status;
}
