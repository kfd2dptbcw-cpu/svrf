# Production checklist

## Configuration
- [ ] `NEXT_PUBLIC_SITE_URL` set to the public URL (including `NEXT_BASE_PATH` if used)
- [ ] `CRON_SECRET` set to a long random value (the cron endpoint refuses to run without it in production)
- [ ] `FORECAST_DATA_SOURCE` is **not** `sample`
- [ ] Production refuses to build or start if `FORECAST_DATA_SOURCE=xweather` and a key is missing; confirm the deploy log shows no "Invalid production configuration"
- [ ] `XWEATHER_MIN_REMAINING` / `XWEATHER_WARN_REMAINING` set as wanted (defaults 1,000 / 3,000); `/api/health` → `allowance.paused` alerts you when refreshes have stopped
- [ ] `XWEATHER_CLIENT_ID` / `XWEATHER_CLIENT_SECRET` set (with your production domain registered on the Xweather app), and `npm run provider:check` passes with them
- [ ] `npm run provider:check` with production keys shows a projected monthly usage under your allowance (it reads Xweather's own `X-Cost-Tokens` charge). After launch, `/api/health` → `lastRefreshUsage` shows what each refresh really cost and how much allowance is left
- [ ] Shared cache configured on serverless hosts (`UPSTASH_REDIS_REST_URL` / `_TOKEN`), or a persistent volume for `.forecast-cache` when self-hosting
- [ ] `EMBED_ALLOWED_ORIGINS` restricted to your own domains if you don't want third parties embedding widgets
- [ ] `npm run config:validate` passes, and every spot shows a forecast (check `spotsWithForecast` in `/api/health`)

## Scheduling and data
- [ ] Cron configured: `vercel.json` on Vercel, or the GitHub Actions workflow or host cron elsewhere
- [ ] A manual `?force=1` refresh succeeds and returns `"status": "live"`
- [ ] `/api/health` added to an uptime monitor (alert on 503 and on `degraded: true` lasting longer than 12 hours)
- [ ] Usage terms reviewed: confirm Vaisala's subscription terms cover your use of the Xweather free tier. If `FALLBACK_DATA_SOURCE=open-meteo`, note Open-Meteo's free API is non-commercial only, so commercial sites need an Open-Meteo plan (set `OPEN_METEO_API_KEY` and the endpoints) or a self-hosted instance. Heavy map traffic should use a commercial tile provider rather than OpenStreetMap's tile servers.
- [ ] Optional: ADMIRALTY key and `tideStationId`s added for official tide times

## SEO
- [ ] `/sitemap.xml` and `/robots.txt` reachable, and the sitemap submitted to Google Search Console
- [ ] Open Graph previews checked (e.g. with a link preview debugger) for `/` and a spot page
- [ ] Structured data validated with Google's Rich Results Test on a spot page

## Quality
- [ ] `npm run check` and `npm run build` pass
- [ ] Lighthouse is 95+ for Performance, Accessibility, Best Practices and SEO on `/` and a spot page (mobile and desktop)
- [ ] Tested in light and dark mode, on mobile and desktop, and with keyboard-only navigation
- [ ] Embeds tested on the host website

## Content and legal
- [ ] Attribution kept: "Powered by Vaisala Xweather" linking to xweather.com appears in the site footer and every embed widget automatically (Xweather requires it wherever its data is shown — keep it if you restyle the footer or render `/api/forecast` data on your own site). Open-Meteo requires CC BY 4.0 credit when used; OpenStreetMap credit is on the map
- [ ] The "not for navigation" tide disclaimer and the safety section on `/about` reviewed
- [ ] Spot hazards and descriptions reviewed by someone with local knowledge
