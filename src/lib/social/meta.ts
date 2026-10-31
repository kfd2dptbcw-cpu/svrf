/**
 * Minimal Meta Graph API client for the daily social post.
 *
 *   Facebook Page:   POST /{page-id}/photos            (url + caption, publishes immediately)
 *   Instagram:       POST /{ig-user-id}/media          (image_url + caption → container id)
 *                    GET  /{container-id}?fields=status_code   (wait for FINISHED)
 *                    POST /{ig-user-id}/media_publish  (creation_id)
 *
 * Both use a long-lived Page access token from a Facebook Page that the
 * Instagram professional account is linked to. Meta fetches the image from
 * our public URL, so the site must be deployed and reachable.
 */

export interface MetaConfig {
  pageId: string;
  pageAccessToken: string;
  instagramUserId: string | null;
  graphVersion: string;
}

type Fetch = typeof fetch;

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

async function graph<T>(
  config: MetaConfig,
  path: string,
  params: Record<string, string>,
  method: "GET" | "POST",
  fetchImpl: Fetch,
): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: config.pageAccessToken });
  const response =
    method === "GET"
      ? await fetchImpl(`${url}?${body}`, { signal: AbortSignal.timeout(30_000) })
      : await fetchImpl(url, { method: "POST", body, signal: AbortSignal.timeout(60_000) });
  const json = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok || json.error) {
    // Never echo the token: only Meta's error message goes into logs.
    throw new MetaApiError(`Meta ${method} ${path}: ${json.error?.message ?? response.statusText}`, response.status);
  }
  return json;
}

/** Post a photo with a caption to the Facebook Page. Returns the post id. */
export async function postFacebookPhoto(config: MetaConfig, imageUrl: string, caption: string, fetchImpl: Fetch = fetch) {
  const result = await graph<{ id: string; post_id?: string }>(
    config,
    `${config.pageId}/photos`,
    { url: imageUrl, caption, published: "true" },
    "POST",
    fetchImpl,
  );
  return result.post_id ?? result.id;
}

/** Publish an image to Instagram. Returns the media id. */
export async function postInstagramImage(
  config: MetaConfig,
  imageUrl: string,
  caption: string,
  { fetchImpl = fetch, pollMs = 3000, maxPolls = 20 }: { fetchImpl?: Fetch; pollMs?: number; maxPolls?: number } = {},
) {
  if (!config.instagramUserId) throw new Error("INSTAGRAM_USER_ID is not set");
  const igUser = config.instagramUserId;
  const container = await graph<{ id: string }>(config, `${igUser}/media`, { image_url: imageUrl, caption }, "POST", fetchImpl);

  for (let attempt = 0; attempt < maxPolls; attempt++) {
    const { status_code: status } = await graph<{ status_code?: string }>(
      config,
      container.id,
      { fields: "status_code" },
      "GET",
      fetchImpl,
    );
    if (status === "FINISHED") break;
    if (status === "ERROR" || status === "EXPIRED") throw new MetaApiError(`Instagram media container ${status}`, 500);
    if (attempt === maxPolls - 1) throw new MetaApiError("Instagram media container was not ready in time", 504);
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  const published = await graph<{ id: string }>(config, `${igUser}/media_publish`, { creation_id: container.id }, "POST", fetchImpl);
  return published.id;
}
