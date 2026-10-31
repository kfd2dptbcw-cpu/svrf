/**
 * Post today's "best surf" card to the SVRF Facebook Page and Instagram.
 *
 *   npm run social:post               # post (once per day per platform)
 *   npm run social:post -- --dry-run  # print the captions and image URL, post nothing
 *   npm run social:post -- --force    # post even before SOCIAL_START_DATE or if already posted
 *
 * Run by .github/workflows/social-post.yml straight after the daily forecast
 * refresh. Reads the shared forecast cache only; never calls a data provider.
 * Skips (exit 0) when Meta isn't configured, before the start date, when the
 * forecast isn't fresh, or when today's post already went out. Exits 1 if a
 * post failed.
 */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File not present — fine.
  }
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");

const { getCacheStore } = await import("../src/lib/cache");
const { bundleKey, readCachedBundle } = await import("../src/lib/forecast/bundle-cache");
const { isFresh } = await import("../src/lib/schedule");
const { nowSeconds, ukDateKey } = await import("../src/lib/time");
const { sanitizeEnvValue } = await import("../src/lib/env");
const social = await import("../src/lib/social/daily-post");
const meta = await import("../src/lib/social/meta");

const notice = (title: string, message: string) => {
  console.log(`${title}: ${message}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::notice title=${title}::${message}`);
};
const envValue = (name: string) => sanitizeEnvValue(name, process.env[name]);

const now = nowSeconds();
const dateKey = ukDateKey(now);
const startDate = envValue("SOCIAL_START_DATE") ?? social.DEFAULT_SOCIAL_START_DATE;
const siteUrl = (envValue("FORECAST_SITE_URL") ?? envValue("NEXT_PUBLIC_SITE_URL") ?? "").replace(/\/$/, "");

if (!social.postingActive(dateKey, startDate) && !force && !dryRun) {
  notice("Social post skipped", `automatic posting starts on ${startDate} (today is ${dateKey})`);
  process.exit(0);
}
if (!/^https:\/\//.test(siteUrl)) {
  console.error("✖ FORECAST_SITE_URL (or NEXT_PUBLIC_SITE_URL) must be the public https:// address of the site: Meta downloads the image from it.");
  process.exit(dryRun ? 0 : 1);
}

// In CI the cache must be the shared one the refresh writes to.
const store = getCacheStore();
if (process.env.CI && store.name !== "upstash") {
  console.error("✖ UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set; can't read the forecast or record what was posted.");
  process.exit(1);
}

const stored = await readCachedBundle();
if (!stored || !stored.configMatches || !isFresh(stored.bundle.generatedAt, now)) {
  const why = !stored
    ? `nothing cached under ${bundleKey()} in the ${store.name} cache (check FORECAST_DATA_SOURCE / XWEATHER_CLIENT_ID match the refresh workflow)`
    : !stored.configMatches
      ? "the cached forecast was made with a different spot configuration"
      : `the cached forecast is from ${new Date(stored.bundle.generatedAt * 1000).toISOString()}`;
  notice("Social post skipped", `no fresh forecast (${why}), so nothing was posted rather than an out-of-date one`);
  process.exit(0);
}
const featured = social.pickFeaturedSpots(stored.bundle, dateKey);
if (featured.length === 0) {
  notice("Social post skipped", "every spot is flat today");
  process.exit(0);
}

// Cache-buster so Meta never reuses yesterday's image from a CDN.
const imageUrl = `${siteUrl}${social.socialCardPath(dateKey)}&v=${stored.bundle.generatedAt}`;
const captions = {
  facebook: social.buildCaption(featured, dateKey, siteUrl, "facebook"),
  instagram: social.buildCaption(featured, dateKey, siteUrl, "instagram"),
};

if (dryRun) {
  console.log(`Image: ${imageUrl}\n\n── Facebook ──\n${captions.facebook}\n\n── Instagram ──\n${captions.instagram}`);
  process.exit(0);
}

const pageId = envValue("META_PAGE_ID");
const pageAccessToken = envValue("META_PAGE_ACCESS_TOKEN");
if (!pageId || !pageAccessToken) {
  notice("Social post skipped", "META_PAGE_ID / META_PAGE_ACCESS_TOKEN are not set");
  process.exit(0);
}
const config = {
  pageId,
  pageAccessToken,
  instagramUserId: envValue("INSTAGRAM_USER_ID"),
  graphVersion: envValue("META_GRAPH_VERSION") ?? "v23.0",
};

// Make sure the card renders before handing Meta the URL (also warms the CDN).
const check = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
if (!check.ok || !check.headers.get("content-type")?.startsWith("image/jpeg")) {
  console.error(`✖ Social card did not render (${check.status} ${check.headers.get("content-type") ?? ""}) at ${imageUrl}`);
  process.exit(1);
}

// One record per day, so a re-run after a partial failure only retries what's missing.
const lockKey = `social-post-lock:${dateKey}`;
if (!(await store.acquireLock(lockKey, 600))) {
  notice("Social post skipped", "another run is posting right now");
  process.exit(0);
}
const stateKey = `social-post:${dateKey}`;
const state = JSON.parse((await store.get(stateKey)) ?? "{}") as Partial<Record<"facebook" | "instagram", string>>;

let failed = false;
const platforms = [
  { name: "facebook" as const, enabled: true, post: () => meta.postFacebookPhoto(config, imageUrl, captions.facebook) },
  { name: "instagram" as const, enabled: Boolean(config.instagramUserId), post: () => meta.postInstagramImage(config, imageUrl, captions.instagram) },
];
try {
  for (const platform of platforms) {
    if (!platform.enabled) {
      notice(`${platform.name} skipped`, "INSTAGRAM_USER_ID is not set");
      continue;
    }
    if (state[platform.name] && !force) {
      console.log(`${platform.name}: already posted today (${state[platform.name]})`);
      continue;
    }
    try {
      state[platform.name] = await platform.post();
      await store.set(stateKey, JSON.stringify(state));
      console.log(`✔ ${platform.name}: posted ${state[platform.name]}`);
    } catch (error) {
      failed = true;
      console.error(`✖ ${platform.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} finally {
  await store.releaseLock(lockKey);
}
process.exit(failed ? 1 : 0);
