import { describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/cache/memory-store";
import { buildCaption } from "@/lib/social/daily-post";
import {
  REFRESH_TOKEN_KEY,
  getAccessToken,
  parsePrivacyLevel,
  postTikTokPhoto,
  splitTikTokCaption,
  waitForPublish,
  type TikTokConfig,
} from "@/lib/social/tiktok";

const config: TikTokConfig = { clientKey: "ck", clientSecret: "cs", refreshToken: "seed-token", privacyLevel: "SELF_ONLY" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("TikTok client", () => {
  it("defaults to private and rejects unknown privacy levels", () => {
    expect(parsePrivacyLevel(undefined)).toBe("SELF_ONLY");
    expect(parsePrivacyLevel("public")).toBe("SELF_ONLY");
    expect(parsePrivacyLevel("public_to_everyone")).toBe("PUBLIC_TO_EVERYONE");
  });

  it("refreshes the access token and keeps a rotated refresh token for next time", async () => {
    const store = new MemoryStore();
    const fetchImpl = vi.fn(async () => json({ access_token: "access-1", refresh_token: "rotated-1" })) as unknown as typeof fetch;
    expect(await getAccessToken(config, store, fetchImpl)).toBe("access-1");
    const firstBody = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1].body as URLSearchParams;
    expect(firstBody.get("refresh_token")).toBe("seed-token");
    expect(firstBody.get("grant_type")).toBe("refresh_token");
    expect(await store.get(REFRESH_TOKEN_KEY)).toContain("rotated-1");

    await getAccessToken(config, store, fetchImpl);
    const secondBody = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[1]![1].body as URLSearchParams;
    expect(secondBody.get("refresh_token")).toBe("rotated-1");
  });

  it("uses a re-authorised secret instead of the stored chain", async () => {
    const store = new MemoryStore();
    const fetchImpl = vi.fn(async () => json({ access_token: "a", refresh_token: "rotated" })) as unknown as typeof fetch;
    await getAccessToken(config, store, fetchImpl);
    await getAccessToken({ ...config, refreshToken: "new-seed" }, store, fetchImpl);
    const body = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[1]![1].body as URLSearchParams;
    expect(body.get("refresh_token")).toBe("new-seed");
  });

  it("surfaces TikTok's error without leaking secrets", async () => {
    const fetchImpl = vi.fn(async () => json({ error: "invalid_grant", error_description: "Refresh token is invalid" }, 400)) as unknown as typeof fetch;
    const error = await getAccessToken(config, new MemoryStore(), fetchImpl).catch((e: Error) => e);
    expect((error as Error).message).toContain("Refresh token is invalid");
    expect((error as Error).message).not.toContain("cs");
    expect((error as Error).message).not.toContain("seed-token");
  });

  it("posts a private photo by URL and returns the publish id", async () => {
    const fetchImpl = vi.fn(async () => json({ data: { publish_id: "p123" }, error: { code: "ok", message: "" } })) as unknown as typeof fetch;
    const id = await postTikTokPhoto(config, "tok", "https://forecast.svrf.uk/card.jpg", "Title line\n\nBody text", fetchImpl);
    expect(id).toBe("p123");
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("https://open.tiktokapis.com/v2/post/publish/content/init/");
    expect(init.headers.Authorization).toBe("Bearer tok");
    const body = JSON.parse(init.body as string);
    expect(body.media_type).toBe("PHOTO");
    expect(body.post_mode).toBe("DIRECT_POST");
    expect(body.post_info.privacy_level).toBe("SELF_ONLY");
    expect(body.source_info).toEqual({ source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: ["https://forecast.svrf.uk/card.jpg"] });
  });

  it("throws when TikTok rejects the post", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ error: { code: "url_ownership_unverified", message: "Verify the domain" } }, 400),
    ) as unknown as typeof fetch;
    await expect(postTikTokPhoto(config, "tok", "https://x/y.jpg", "t", fetchImpl)).rejects.toThrow(/url_ownership_unverified/);
  });

  it("waits for PUBLISH_COMPLETE and throws on FAILED", async () => {
    const statuses = ["PROCESSING_DOWNLOAD", "PUBLISH_COMPLETE"];
    const ok = vi.fn(async () => json({ data: { status: statuses.shift() }, error: { code: "ok" } })) as unknown as typeof fetch;
    expect(await waitForPublish("tok", "p1", { fetchImpl: ok, pollMs: 0 })).toBe("PUBLISH_COMPLETE");
    const failed = vi.fn(async () => json({ data: { status: "FAILED", fail_reason: "picture_size_check_failed" }, error: { code: "ok" } })) as unknown as typeof fetch;
    await expect(waitForPublish("tok", "p1", { fetchImpl: failed, pollMs: 0 })).rejects.toThrow(/picture_size_check_failed/);
  });

  it("splits a caption into a 90-character title and a description", () => {
    const { title, description } = splitTikTokCaption(`${"x".repeat(120)}\n\nrest of it`);
    expect([...title]).toHaveLength(90);
    expect(description).toBe("rest of it");
  });

  it("builds a link-free TikTok caption with hashtags", () => {
    const caption = buildCaption([], "2026-11-05", "https://forecast.svrf.uk", "tiktok");
    expect(caption).toContain("link in bio");
    expect(caption).toContain("#surf");
    expect(caption).not.toContain("https://");
  });
});
