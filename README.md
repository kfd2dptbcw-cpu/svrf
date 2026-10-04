# UK Surf Forecast

A fast, embeddable surf forecast for 34 of the UK's best surf spots. It is built with Next.js 15 and runs on Vaisala Xweather's free developer tier (15,000 API accesses a month), with Open-Meteo available as an alternative or backup.

- **Automatic updates** at 06:00 and 18:00 UTC. Processed forecasts are cached for 12 hours and pages are regenerated incrementally (ISR).
- **For each spot:** surf height, primary swell (height, period, direction), wind speed, direction and type, air and sea temperature, tides, the best surf window, a 1–5 star rating, suitability for beginner, intermediate and advanced surfers, and a short written forecast.
- **Forecast engine** that scores every hour from wave size, period, wind relative to the beach, swell direction and tide (see [docs/ALGORITHM.md](docs/ALGORITHM.md)).
- **JSON configuration.** Add, remove or tune spots without touching code ([docs/CONFIGURATION.md](docs/CONFIGURATION.md)).
- **Swappable data providers:** Vaisala Xweather (Maritime and Forecasts APIs), Open-Meteo Marine and Weather (Météo-France, ECMWF, NOAA WaveWatch III, UK Met Office UKV) and optional official ADMIRALTY tide predictions.
- **Resilient.** Requests time out, retry with backoff and respect rate limits. When live data can't be fetched, the last good forecast is shown and clearly labelled.
- **UI:** glassmorphism, dark mode, animated swell and wind arrows, star ratings, an interactive Leaflet map, instant search, filters and favourites.
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
    api/cron/refresh/       Scheduled refresh endpoint (06:00 and 18:00 UTC)
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
    forecast/service.ts     Caching, refresh scheduling and failure handling
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
| `GET/POST /api/cron/refresh` | Scheduled refresh. Requires `Authorization: Bearer $CRON_SECRET`. Add `?force=1` to bypass the freshness check. |

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
| `NEXT_PUBLIC_SITE_NAME` | `UK Surf Forecast` | Branding |
| `CRON_SECRET` | – | Protects `/api/cron/refresh`. **Required in production.** |
| `REFRESH_HOURS_UTC` | `6,18` | When a new forecast becomes due |
| `FORECAST_DATA_SOURCE` | `xweather` if its keys are set, else `open-meteo` | `sample` gives clearly labelled synthetic data for development |
| `XWEATHER_CLIENT_ID` / `_SECRET` | – | Xweather credentials |
| `FALLBACK_DATA_SOURCE` | `none` | Backup source for spots the primary can't serve (`open-meteo` or `xweather`) |
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
 Vercel Cron / GitHub Actions ──► /api/cron/refresh (06:05 & 18:05 UTC)
                                        │
 Page request (ISR, revalidate 1h) ─────┤
                                        ▼
                            forecast/service.ts
          1. in-memory copy fresh?  ── yes ─► return
          2. cache store fresh?     ── yes ─► return            (file / Upstash)
          3. refresh: providers ──► engine ──► write cache
          4. on failure: last good forecast marked "stale",
             back off REFRESH_FAILURE_BACKOFF_SECONDS
```

- A forecast is **fresh** if it was generated after the latest refresh slot (06:00 or 18:00 UTC) and is less than 12 hours old. However much traffic the site gets, each instance calls the upstream APIs at most once per slot.
- **API usage per full refresh of 34 spots:** at least one access per spot per endpoint on Xweather, so 68 accesses (≈4,200 a month at two refreshes a day). Xweather may also bill multi-day requests per day covered, so confirm the real figure with `npm run provider:check`, which reads Xweather's `X-Cost-Tokens` header and projects monthly usage. Each refresh logs its cost, and `/api/health` reports it with the remaining allowance. Requests run four at a time, and the batch stops at the first authentication or quota error so a bad key can't burn through accesses. Open-Meteo accepts many coordinates in one call, so it needs only 2–4 requests. Sunrise and sunset are calculated locally and cost nothing.
- Pages are statically generated at build time and revalidated hourly from the cache (ISR). After each scheduled refresh, `revalidatePath` regenerates every page.
- **Failures:** each request has a timeout and up to two retries with exponential backoff. `429` responses honour `Retry-After`, and long rate-limit windows are not waited out inside a request. If weather or tide data is missing, the forecast is still built from marine data and the gaps are noted. If marine data is missing, the stale cache is served. With no cache at all, the UI shows a clear "temporarily unavailable" message.

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
npm test                # 40 unit tests: engine, tides, scoring, schedule, config, HTTP client, search
npm run check           # config validation + typecheck + lint + tests
```

[docs/TESTING.md](docs/TESTING.md) covers manual checks: offline mode, simulating API failures, testing the cron endpoint and running Lighthouse.

---

## Deployment

- **Vercel (recommended):** import the repo, set `NEXT_PUBLIC_SITE_URL` and `CRON_SECRET` (and ideally the Upstash variables), then deploy. `vercel.json` already schedules the cron.
- **Docker / VPS:** `docker build` with the included `Dockerfile` (standalone output), then mount a volume for `.forecast-cache`.
- **Other hosts:** use the included GitHub Actions workflow (`.github/workflows/scheduled-refresh.yml`) to trigger refreshes.

Step-by-step guides are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Check [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) before going live.

---

## Extending (future features)

The code is layered so each of these can be added without restructuring:

| Feature | Where it plugs in |
| --- | --- |
| **User favourites** | Already implemented client-side (`hooks/useFavourites.ts`, localStorage). To sync with accounts, replace the storage functions in that hook with API calls. The component API stays the same. |
| **Surf alerts / push notifications / email forecasts** | Run a job after `refreshForecasts()` (`lib/forecast/service.ts`, or right after `runScheduledRefresh` in `lib/forecast/refresh.ts`). Compare each subscriber's rules (spot, minimum rating, skill level) against `bundle.spots[slug].days`. Everything needed (rating, `bestWindow`, `suitability`, `summary`) is already computed. |
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
