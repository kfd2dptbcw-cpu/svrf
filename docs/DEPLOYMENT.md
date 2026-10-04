# Deployment guide

The app runs anywhere Next.js 15 runs. It needs:

1. **Persistent or shared cache storage** (optional but recommended), so forecasts survive restarts and are shared between instances.
2. **A scheduler** that calls `/api/cron/refresh` at 06:05 and 18:05 UTC. The app also refreshes on demand when a request finds the cache out of date, so the scheduler keeps things fresh but isn't strictly required.

## Option A — Vercel (recommended)

1. Push the repository to GitHub and click **New Project** in Vercel to import it.
2. Add these environment variables (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_SITE_URL`: your production URL, e.g. `https://surf.example.com`
   - `CRON_SECRET`: a long random string (`openssl rand -hex 32`)
   - Recommended: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from a free Upstash Redis database (or the Vercel Marketplace integration). Without them each serverless instance keeps its own `/tmp` cache.
3. Deploy. `vercel.json` registers two cron jobs (`5 6 * * *` and `5 18 * * *`), and Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
4. Check: open `https://your-domain/api/health`. It should report `"status": "live"` or `"cached"`.
5. Optional: add a custom domain such as `surf.example.com` and link to it from your main site, or embed widgets (see the README).

The Hobby plan allows these two daily cron jobs. Cron timing on Hobby is approximate (within the hour), which is fine because requests also trigger a refresh when the data is due.

## Option B — Docker / VPS

```bash
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://surf.example.com \
  -t uk-surf-forecast .

docker run -d --name surf -p 3000:3000 \
  -e NEXT_PUBLIC_SITE_URL=https://surf.example.com \
  -e CRON_SECRET=... \
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

Deploy as a standard Next.js app. These hosts don't read `vercel.json`, so enable the included GitHub Actions workflow `.github/workflows/scheduled-refresh.yml`:

1. Repository → Settings → Secrets and variables → Actions → add `FORECAST_SITE_URL` and `CRON_SECRET`.
2. The workflow runs at 06:05 and 18:05 UTC and can also be started manually (**Run workflow**, with an optional force flag).

Use Upstash (`UPSTASH_REDIS_REST_URL` / `_TOKEN`) for the cache when the host's filesystem is ephemeral.

## Mounting under your existing site

| Approach | How |
| --- | --- |
| Subdomain | Deploy to `surf.example.com` and link to it from your site's navigation. |
| Sub-path | Set `NEXT_BASE_PATH=/surf-forecast` and `NEXT_PUBLIC_SITE_URL=https://www.example.com/surf-forecast`, then proxy `/surf-forecast/*` from your main site to this app. On Vercel use a rewrite in the main site; with Nginx use `location /surf-forecast/ { proxy_pass http://surf-app:3000; }`. |
| Widgets | Add `<div data-surf-forecast="/embed/cornwall/fistral"></div>` and `<script src="https://surf.example.com/embed.js" async></script>`. Limit which sites can embed with `EMBED_ALLOWED_ORIGINS`. |

## Updating spots in production

Edit `config/spots.json`, run `npm run config:validate`, commit and redeploy. The cache key includes a hash of the config, so the next request fetches data for the new spot list.

## Triggering a manual refresh

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://surf.example.com/api/cron/refresh?force=1"
```
