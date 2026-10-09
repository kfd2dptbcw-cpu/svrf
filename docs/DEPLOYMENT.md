# Deployment guide

The app runs anywhere Next.js 15 runs. It needs:

1. **Persistent or shared cache storage** (optional but recommended), so forecasts survive restarts and are shared between instances.
2. **The scheduled refresh**: `.github/workflows/scheduled-refresh.yml` runs `npm run refresh` in GitHub Actions at 06:05 and 18:05 UTC and writes the forecast to Upstash. This is the only thing that calls the data providers: pages, embeds, OG images, API routes and the build only read the cache, so a refresh can never be triggered (or retried in a loop) by site traffic or a function timeout. Without a cached forecast the site shows "temporarily unavailable".

### The refresh workflow (all hosts)

1. Repository → Settings → Secrets and variables → Actions → add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `XWEATHER_CLIENT_ID` and `XWEATHER_CLIENT_SECRET`. Add `FORECAST_DATA_SOURCE`, `FORECAST_DAYS`, `XWEATHER_INTERVAL_HOURS`, `TIDE_PROVIDER` etc. if the site sets them (they must match, or the site reads a different cache key). Optionally add `FORECAST_SITE_URL` and `CRON_SECRET` so pages regenerate right after each refresh.
2. The workflow runs twice a day and can be started manually (**Run workflow**, with an optional force flag).
3. Loop guard: every attempt first writes `last-refresh-attempt` to Upstash, and a refresh refuses to start if the previous attempt was under 3 hours ago, whether it succeeded or not. `npm run refresh -- --force` overrides it.
4. Every attempt's accesses (failed ones included) are recorded in Upstash; `/api/health` → `accessesLast24h` shows the total, and over `XWEATHER_DAILY_WARN` (300) a day the refresh and health check log a loud warning.

## Option A — Vercel (recommended)

1. Push the repository to GitHub and click **New Project** in Vercel to import it.
2. Add these environment variables (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_SITE_URL`: your production URL, e.g. `https://surf.example.com`
   - `CRON_SECRET`: a long random string (`openssl rand -hex 32`)
   - `XWEATHER_CLIENT_ID` and `XWEATHER_CLIENT_SECRET`: from your Xweather account (Apps → add an app with your production domain as its namespace)
   - Recommended: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from a free Upstash Redis database (or the Vercel Marketplace integration). Without them each serverless instance keeps its own `/tmp` cache.
3. Deploy, and set up [the refresh workflow](#the-refresh-workflow-all-hosts). `vercel.json` also pings the read-only `/api/cron/refresh` at 06:05 and 18:05 UTC; it only regenerates pages from the cache.
4. Check: open `https://your-domain/api/health`. It should report `"status": "live"` or `"cached"`.
5. Optional: add a custom domain such as `surf.example.com` and link to it from your main site, or embed widgets (see the README).

## Option B — Docker / VPS

```bash
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://surf.example.com \
  -t uk-surf-forecast .

docker run -d --name surf -p 3000:3000 \
  -e NEXT_PUBLIC_SITE_URL=https://surf.example.com \
  -e CRON_SECRET=... \
  -e XWEATHER_CLIENT_ID=... -e XWEATHER_CLIENT_SECRET=... \
  -v surf-cache:/app/.forecast-cache \
  --restart unless-stopped \
  uk-surf-forecast
```

Put a reverse proxy (Nginx, Caddy, Traefik) in front for TLS. Schedule the refresh with cron on the host:

```cron
5 6,18 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://surf.example.com/api/cron/refresh >/dev/null
```

Without Docker:

```bash
npm ci
NEXT_OUTPUT=standalone npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
node .next/standalone/server.js     # run under systemd or pm2
```

## Option C — Netlify, Render, Fly.io, Railway…

Deploy as a standard Next.js app with the Upstash variables set, and set up [the refresh workflow](#the-refresh-workflow-all-hosts).

## Xweather keys and quota

1. Sign up at <https://signup.xweather.com/> and create an app. Its namespace must match where requests come from: your production domain for server-side use (Xweather also accepts `localhost` for development).
2. Set `XWEATHER_CLIENT_ID` and `XWEATHER_CLIENT_SECRET` wherever the app runs (Vercel settings, Docker `-e`, `.env.local`).
3. Run `npm run provider:check` locally with the same keys to confirm the data comes through.
4. Budget: `npm run provider:check` reads the real charge from Xweather's `X-Cost-Tokens` header, works out whether requests bill flat, per day or per period, and lists the projected monthly total for hourly/3-hourly data over 7 or 5 days against `XWEATHER_MONTHLY_BUDGET` (12,000 by default; 34 spots × refreshes/day × 31 days). Apply its recommendation with `XWEATHER_INTERVAL_HOURS` and `FORECAST_DAYS`. If nothing fits, refresh once a day or disable some spots.
5. Hard cap: once `X-RateLimit-Remaining-Period` drops below `XWEATHER_MIN_REMAINING` (1,000), Xweather refreshes stop and the site serves the cached forecast until the period resets; below `XWEATHER_WARN_REMAINING` (3,000) each refresh logs a warning. The current reading is in `/api/health` → `allowance`.
6. Missing keys: with `FORECAST_DATA_SOURCE=xweather`, production builds and server starts fail with "Invalid production configuration" if either key is missing. The app never silently falls back to Open-Meteo.

Use the Upstash shared cache: the refresh workflow writes there and every instance of the site reads from it.

## Mounting under your existing site

| Approach | How |
| --- | --- |
| Subdomain | Deploy to `surf.example.com` and link to it from your site's navigation. |
| Sub-path | Set `NEXT_BASE_PATH=/surf-forecast` and `NEXT_PUBLIC_SITE_URL=https://www.example.com/surf-forecast`, then proxy `/surf-forecast/*` from your main site to this app. On Vercel use a rewrite in the main site; with Nginx use `location /surf-forecast/ { proxy_pass http://surf-app:3000; }`. |
| Widgets | Add `<div data-surf-forecast="/embed/cornwall/fistral"></div>` and `<script src="https://surf.example.com/embed.js" async></script>`. Limit which sites can embed with `EMBED_ALLOWED_ORIGINS`. |

## Updating spots in production

Edit `config/spots.json`, run `npm run config:validate`, commit and redeploy, then run the refresh workflow with **force**. Until then the cached forecast is served as stale (the cache records a hash of the config).

## Triggering a manual refresh

Actions → **Scheduled forecast refresh** → **Run workflow** (tick *force* to bypass the 3-hour guard), or locally with the production Upstash and Xweather variables in `.env.local`:

```bash
npm run refresh -- --force
```
