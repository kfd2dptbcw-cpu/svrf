# SVRF Surf Forecast

The surf forecast for [SVRF](https://svrf.uk): a fast, embeddable surf forecast for 34 of the UK's best surf spots. It is built with Next.js 15 and runs on Vaisala Xweather's free developer tier (15,000 API accesses a month), with Open-Meteo available as an alternative or backup.

- **Automatic updates** once a day at 06:00 UTC. Processed forecasts stay fresh for 26 hours (one day plus a 2-hour grace for a late refresh) and pages are regenerated incrementally (ISR).
- **For each spot:** surf height, primary swell (height, period, direction), wind speed, direction and type, air and sea temperature, tides, the best surf window, a 1–5 star rating, suitability for beginner, intermediate and advanced surfers, and a short written forecast.
- **Forecast engine** that scores every hour from wave size, period, wind relative to the beach, swell direction and tide (see [docs/ALGORITHM.md](docs/ALGORITHM.md)).
- **JSON configuration.** Add, remove or tune spots without touching code ([docs/CONFIGURATION.md](docs/CONFIGURATION.md)).
- **Swappable data providers:** Vaisala Xweather (Maritime and Forecasts APIs), Open-Meteo Marine and Weather (Météo-France, ECMWF, NOAA WaveWatch III, UK Met Office UKV) and optional official ADMIRALTY tide predictions.
- **Resilient.** Requests time out, retry with backoff and respect rate limits. When live data can't be fetched, the last good forecast is shown and clearly labelled.
- **SVRF brand:** flat "SVRF" wordmark, Ink / Slate / Fog / Seafoam / Chalk with Flag Orange as the single accent, Archivo Black headlines, Inter body and JetBrains Mono data (fonts self-hosted). Dark mode, animated swell and wind arrows, star ratings, an interactive Leaflet map, instant search, filters and favourites.
- **SEO:** metadata, Open Graph images (a dynamic one per spot), JSON-LD structured data, an XML sitemap, robots.txt and friendly URLs such as `/surf/cornwall/fistral`.
- **Embeddable** iframe widgets with automatic resizing for your existing website.

```
★★★★☆  Excellent
4-5ft clean surf.
Long-period WNW swell (1.6m at 13s).
Light offshore easterly winds.
Best between 7am–11am around mid tide on the push.
```

---

## Contents

1. [Quick start](#quick-start)
2. [Project structure](#project-structure)
3. [Pages and API](#pages-and-api)
4. [Managing surf spots](#managing-surf-spots)
5. [Environment variables](#environment-variables)
6. [How data flows](#how-data-flows)
7. [Embedding in your website](#embedding-in-your-website)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Extending (future features)](#extending-future-features)
11. [Data sources and licences](#data-sources-and-licences)

---

## Quick start

Requirements: **Node.js 20.9 or later** (22 LTS recommended) and npm.

```bash
npm install
cp .env.example .env.local     # optional for local development
npm run dev                    # http://localhost:3000
```

Add your Xweather keys to `.env.local` (`XWEATHER_CLIENT_ID`, `XWEATHER_CLIENT_SECRET`), then check they work against real data:

```bash
npm run provider:check            # fetches Fistral (2 accesses) and reports any missing or implausible fields
```

The first page view fetches live data for every spot and caches it in `.forecast-cache/`. Without Xweather keys the app uses Open-Meteo, which needs no key but is free for non-commercial use only.

**Working offline?** Start with synthetic data instead. The UI shows a "Sample data" banner whenever this is on:

```bash
FORECAST_DATA_SOURCE=sample npm run dev
```

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | Strict TypeScript check |
| `npm run lint` | ESLint (Next.js Core Web Vitals and TypeScript rules) |
| `npm run config:validate` | Validate `config/*.json` and regenerate their JSON Schemas |
| `npm run check` | All of the above except the build |

---

## Project structure

```
config/
  regions.json              Regions (name, country, description)
  spots.json                Surf spots: coordinates, orientation, swell/wind/tide preferences
  schema/                   Generated JSON Schemas (editor autocompletion and validation)
src/
  app/
    (site)/                 Main website (header and footer layout)
      page.tsx              Home
      today/ tomorrow/      Daily overviews ranked by rating
      7-day/                Week-ahead matrix
      spots/                All spots, with search and filters
      regions/              Region index
      surf/[region]/        Regional forecast
      surf/[region]/[spot]/ Spot forecast (and its dynamic Open Graph image)
      about/                How the forecasts work
    (embed)/embed/          Chrome-less iframe widgets
    api/forecast/           JSON API (all spots, or /api/forecast/:spot)
    api/cron/refresh/       Refresh status + page regeneration (read-only)
    api/health/             Health and freshness for uptime monitors
    sitemap.ts robots.ts manifest.ts opengraph-image.tsx
  components/
    forecast/               Cards, star ratings, arrows, tide chart, hourly table, matrix…
    explorer/               Client-side filters for /spots
    map/                    Lazy-loaded Leaflet map
    layout/                 Header, footer, instant search, theme toggle
    embed/ favourites/ seo/ ui/
  hooks/                    useFavourites, useDebouncedValue
  lib/
    config/                 JSON config loading and zod validation
    forecast/engine/        The forecast engine (pure functions, fully unit tested)
    forecast/service.ts     Read-only cache access for pages and routes
    forecast/refresh-job.ts The only code that calls the providers (npm run refresh)
    forecast/selectors.ts   Shapes forecast data for pages and client components
    providers/              Data providers (Xweather, Open-Meteo, ADMIRALTY, sample) and fallback wrapper
    cache/                  Cache stores (file, memory, Upstash Redis)
    http/fetch-json.ts      Timeouts, retries, rate-limit handling
  types/forecast.ts         Shared domain types
tests/                      Vitest unit tests
docs/                       Algorithm, configuration, deployment, testing, production checklist
public/embed.js             Embed loader script for third-party sites
```

---

## Pages and API

| URL | Description |
| --- | --- |
| `/` | Home: best spots today, interactive map, regions |
| `/today`, `/tomorrow` | Every spot ranked, top picks and per-region sections |
| `/7-day` | 7-day matrix of surf size and rating |
| `/spots` | All spots with instant search and filters (region, wave height, skill, rating, wind, best today/tomorrow, favourites). Filters are kept in the URL. |
| `/regions`, `/surf/:region` | Regional forecasts |
| `/surf/:region/:spot` | Full spot forecast: conditions, suitability, 7-day strip, tide chart and hourly tables |
| `/about` | How the forecasts work |
| `/embed`, `/embed/:region`, `/embed/:region/:spot` | Embeddable widgets |
| `GET /api/forecast` | Daily summaries for all spots (JSON) |
| `GET /api/forecast/:spot` | Full hourly and daily forecast for one spot |
| `GET /api/health` | Data status: `200` while serving forecasts (`degraded: true` when stale), `503` when nothing is available |
| `GET/POST /api/cron/refresh` | Refresh status (read-only; never calls the providers) and page regeneration. Requires `Authorization: Bearer $CRON_SECRET`. |

---

## Managing surf spots

All spot data lives in **`config/spots.json`**; no code changes are needed. Each entry looks like this:

```jsonc
{
  "slug": "fistral",                     // URL: /surf/cornwall/fistral
  "name": "Fistral Beach",
  "region": "cornwall",                  // must exist in config/regions.json
  "location": { "lat": 50.417, "lon": -5.101 },
  "orientation": 290,                    // direction the beach faces (degrees or "WNW")
  "breakType": "beach",                  // beach | reef | point | rivermouth
  "skillLevels": ["beginner", "intermediate", "advanced"],
  "swell": { "window": ["SW", "N"], "optimal": "WNW", "minPeriod": 8 },
  "wind": { "preferred": ["ESE", "SE"] },
  "tide": { "ideal": ["low", "mid"], "sensitivity": 0.3 },
  "waveRangeFt": [2, 8],
  "sizeFactor": 1.0,
  "description": "…",
  "hazards": ["…"],
  "enabled": true
}
```

- **Add a spot:** add an object and run `npm run config:validate`.
- **Remove a spot:** delete it, or set `"enabled": false` to hide it while keeping its settings.
- **Change coordinates, orientation or preferred swell:** edit the fields. Directions accept compass points (`"WNW"`) or degrees (`292.5`).

Changes take effect on the next deploy. The cached forecast is invalidated automatically, because the cache key includes a hash of the configuration. Every field is described in [docs/CONFIGURATION.md](docs/CONFIGURATION.md). Editors that support JSON Schema (VS Code and others) give autocompletion and inline errors through the `$schema` reference.

---

## Environment variables

Everything is optional for local development. See [`.env.example`](.env.example) for the full list with comments.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical URL. **Required in production.** Include `NEXT_BASE_PATH` if you use one. |
| `NEXT_PUBLIC_SITE_NAME` | `SVRF Surf Forecast` | Name used in titles and metadata (the header wordmark is always "SVRF") |
| `CRON_SECRET` | – | Protects `/api/cron/refresh`. **Required in production.** |
| `XWEATHER_DAILY_WARN` | `300` | Loud log warning when refreshes used more accesses than this in 24 hours |
| `REFRESH_HOURS_UTC` | `6` | When a new forecast becomes due (keep in step with the workflow cron). Freshness window = longest gap between slots + 2 h |
| `FORECAST_DATA_SOURCE` | `xweather` if its keys are set, else `open-meteo` | `sample` gives clearly labelled synthetic data for development |
| `XWEATHER_CLIENT_ID` / `_SECRET` | – | Xweather credentials |
| `FALLBACK_DATA_SOURCE` | `none` | Backup source for spots the primary can't serve (`open-meteo` or `xweather`) |
| `XWEATHER_INTERVAL_HOURS` | `1` | `3` requests 3-hourly data (resampled to hourly) to cut per-period billing |
| `XWEATHER_MIN_REMAINING` / `XWEATHER_WARN_REMAINING` | `1000` / `3000` | Hard monthly cap: below the first, Xweather refreshes stop and cached forecasts are served until the billing period resets; below the second, each refresh logs a warning |
| `XWEATHER_MONTHLY_BUDGET` | `12000` | Budget `npm run provider:check` plans against |
| `TIDE_PROVIDER` | `modelled` | `admiralty` uses official UKHO predictions (needs `ADMIRALTY_API_KEY` plus `tideStationId` on each spot) |
| `CACHE_DRIVER` | `file` | `file`, `memory` or `upstash` (chosen automatically when the Upstash variables are set) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | – | Shared cache for serverless hosts (free tier available) |
| `NEXT_BASE_PATH` | – | Serve under a sub-path, e.g. `/surf-forecast` |
| `EMBED_ALLOWED_ORIGINS` | `*` | Which sites may iframe the widgets |
| `FRAME_ANCESTORS` | `'self'` | Which sites may iframe the full app |
| `NEXT_PUBLIC_MAP_TILE_URL` | OpenStreetMap | Map tile server |

---

## How data flows

```
 GitHub Actions (daily, 06:05 UTC) ──► npm run refresh  (forecast/refresh-job.ts)
          1. refuse if last-refresh-attempt < 3 h ago (unless --force)
          2. write last-refresh-attempt
          3. providers ──► engine ──► write cache (Upstash)
          4. record accesses used (success or failure) in refresh-usage-log
                                        │
                                        ▼
 Pages, embeds, OG images, API routes, build ──► forecast/service.ts (read-only)
          cache fresh  ─► "cached"
          cache older  ─► "stale"
          no cache     ─► "unavailable" (embed widgets collapse to nothing)
```

- **Nothing served to visitors ever calls a data provider.** Only `npm run refresh` does, and the 3-hour guard means even a refresh that crashes or is killed half-way can't be retried in a loop. `/api/health` reports `accessesLast24h` (every attempt counted, failed ones included) and the log shows a loud warning above `XWEATHER_DAILY_WARN` (300) a day.
- A forecast is **fresh** for the longest gap between refresh slots plus a 2-hour grace: 26 hours with the default single 06:00 slot, so pages never turn "stale" between daily refreshes, and only do if a refresh is missed.
- **API usage per full refresh of 34 spots:** at least one access per spot per endpoint on Xweather, so 68 accesses (≈2,100 a month at one refresh a day). Xweather may also bill multi-day requests per day covered, so confirm the real figure with `npm run provider:check`, which reads Xweather's `X-Cost-Tokens` header and projects monthly usage. Each refresh logs its cost, and `/api/health` reports it with the remaining allowance. Requests run four at a time, and the batch stops at the first authentication or quota error so a bad key can't burn through accesses. Open-Meteo accepts many coordinates in one call, so it needs only 2–4 requests. Sunrise and sunset are calculated locally and cost nothing.
- Pages are statically generated at build time and revalidated hourly from the cache (ISR). After each scheduled refresh the workflow calls `/api/cron/refresh`, whose `revalidatePath` regenerates every page.
- **Failures:** each request has a timeout and up to two retries with exponential backoff. `429` responses honour `Retry-After`, and long rate-limit windows are not waited out inside a request. If weather or tide data is missing, the forecast is still built from marine data and the gaps are noted. If marine data is missing, the refresh fails and the site keeps serving the stale cache. With no cache at all, the UI shows a clear "temporarily unavailable" message and embed widgets collapse.

---

## Embedding in your website

**Option 1: widgets (recommended).** Add a placeholder and the loader script. The iframe resizes itself to fit its content.

```html
<div data-surf-forecast="/embed/cornwall/fistral"></div>   <!-- one spot -->
<div data-surf-forecast="/embed/devon"></div>              <!-- a region -->
<div data-surf-forecast="/embed"></div>                    <!-- best UK spots today -->
<script src="https://surf.example.com/embed.js" async></script>
```

If you use `NEXT_BASE_PATH`, include it in each `data-surf-forecast` path and in the script URL. Restrict which sites may embed the widgets with `EMBED_ALLOWED_ORIGINS="https://www.example.com"`.

**Option 2: mount the whole app under your domain.** Set `NEXT_BASE_PATH=/surf-forecast` and proxy that path from your main site (an Nginx `location` block, Vercel rewrites, Cloudflare and so on). Alternatively, deploy it on a subdomain such as `surf.example.com` and link to it from your navigation.

**Option 3: use the JSON API** (`/api/forecast`) to render forecasts with your own site's components.

---

## Testing

```bash
npm test                # unit tests: engine, tides, scoring, schedule, config, HTTP client, search
npm run check           # config validation + typecheck + lint + tests
```

[docs/TESTING.md](docs/TESTING.md) covers manual checks: offline mode, simulating API failures, testing the cron endpoint and running Lighthouse.

---

## Brand

| Token | Hex | Use |
| --- | --- | --- |
| Ink | `#0B0D0E` | Text, dark background, "Good" rating |
| Slate | `#4A5459` | Secondary text, "Fair" rating |
| Fog | `#8E9A9C` | Muted text, "Poor" rating |
| Seafoam | `#CFDBDA` | Borders, dividers |
| Chalk | `#EFEEE7` | Light background, text on dark |
| Flag Orange | `#FF4E1F` | The only accent: calls to action, links, best surf window, offshore wind, Excellent/Epic ratings |

Archivo Black for headlines (h1–h3 and the wordmark), Inter for body text, JetBrains Mono for data and labels. Fonts are self-hosted from `@fontsource` packages, so there is no request to Google Fonts. Tokens live in `src/app/globals.css`; Tailwind's `slate` scale is remapped to these neutrals. The header links back to <https://svrf.uk>.

## Deployment

- **Vercel:** import the repo, set `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` and the Upstash variables, then deploy.
- **Docker / VPS:** `docker build` with the included `Dockerfile` (standalone output), then mount a volume for `.forecast-cache`.
- **Every host:** forecasts are refreshed by the included GitHub Actions workflow (`.github/workflows/scheduled-refresh.yml`), which runs `npm run refresh` and writes to Upstash.

Step-by-step guides are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Check [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) before going live.

---

## Extending (future features)

The code is layered so each of these can be added without restructuring:

| Feature | Where it plugs in |
| --- | --- |
| **User favourites** | Already implemented client-side (`hooks/useFavourites.ts`, localStorage). To sync with accounts, replace the storage functions in that hook with API calls. The component API stays the same. |
| **Surf alerts / push notifications / email forecasts** | Run a job after `runRefresh()` in `scripts/refresh.mts`. Compare each subscriber's rules (spot, minimum rating, skill level) against `bundle.spots[slug].days`. Everything needed (rating, `bestWindow`, `suitability`, `summary`) is already computed. |
| **Live webcams** | Add an optional `webcams` array to the spot schema (`lib/config/schema.ts`) and render it on the spot page. |
| **Premium forecasts** | Add a provider (e.g. Stormglass or Met Office DataHub; see `lib/providers/xweather.ts` for a per-spot API example) implementing the interfaces in `lib/providers/types.ts`, and register it in `lib/providers/registry.ts`. |
| **AI surf reports** | `DayForecast` already contains structured conditions and narrative lines. Pass them to an LLM in the refresh job and store the result alongside the bundle. |
| **Surf trip planner** | `/api/forecast` returns 7-day summaries for every spot. A planner page can rank spots by distance and forecast without any new data fetching. |

New data sources only need to implement `MarineProvider`, `WeatherProvider` or `TideProvider`. The engine, cache and UI don't change.

---

## Data sources and licences

- **[Vaisala Xweather](https://www.xweather.com/)** (default). The free developer tier gives 15,000 accesses a month. Use is governed by Vaisala's subscription terms, so confirm they cover your site. Xweather requires a "Powered by Vaisala Xweather" link wherever its data is shown; the footer and embed widgets include it automatically. Above the free tier, pay-as-you-go billing is offered in the US and Canada; elsewhere contact Xweather.
- **[Open-Meteo](https://open-meteo.com/)** (alternative or backup). Free for non-commercial use under [CC BY 4.0](https://open-meteo.com/en/licence); commercial use needs an [Open-Meteo plan](https://open-meteo.com/en/pricing) or a self-hosted instance (point `OPEN_METEO_MARINE_URL` / `OPEN_METEO_WEATHER_URL` at it).
- **[ADMIRALTY UK Tidal API](https://admiraltyapi.portal.azure-api.net/)** (optional). Its free Discovery tier gives official UKHO predictions.
- **[OpenStreetMap](https://www.openstreetmap.org/copyright)** map tiles. Respect the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/), or configure a commercial tile provider for high traffic.

Forecasts are a guide only. Tide data is modelled and **not for navigation**.
