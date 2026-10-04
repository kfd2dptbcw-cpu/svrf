# Testing

## Automated tests

```bash
npm test          # Vitest unit tests
npm run check     # config validation + strict typecheck + ESLint + tests
```

| Suite | Covers |
| --- | --- |
| `tests/angles.test.ts` | Bearings, compass conversion, swell window arcs across north, offshore point projection |
| `tests/scoring.test.ts` | Wind classification, surf size, size, period and tide components, hourly scores, rating thresholds and gates |
| `tests/tide.test.ts` | High/low detection with sub-hour refinement, tide phase and trend, interpolation from events |
| `tests/schedule.test.ts` | Refresh slots and cache freshness |
| `tests/config.test.ts` | Spot configuration loading and validation errors (unknown region, duplicates, bad coordinates) |
| `tests/build.test.ts` | End-to-end engine run for every configured spot (using the synthetic sample providers) |
| `tests/fetch-json.test.ts` | Timeouts, retries, non-retryable errors, rate limits with `Retry-After`, network failures |
| `tests/search.test.ts` | Instant search normalisation and ranking |
| `tests/xweather.test.ts` | Xweather response mapping, no-data spots, stopping on auth errors, weather-code conversion, fallback provider |
| `tests/sun.test.ts` | Sunrise and sunset calculation |

CI (`.github/workflows/ci.yml`) runs all of the above and a production build with sample data, so it never depends on live API quota.

## Manual checks

### Live data

```bash
npm run dev
curl -s localhost:3000/api/health | jq
```

`status` should be `live` on the first call and `cached` afterwards. `.forecast-cache/` now contains the gzipped bundle.

### Provider check (real API)

```bash
npm run provider:check                  # active provider, Fistral
npm run provider:check -- croyde        # another spot
npm run provider:check -- fistral open-meteo
```

It fetches one spot (2 Xweather accesses), prints the coverage and range of every field, builds the daily forecast and exits non-zero if anything required is missing or implausible. Run it whenever you change keys or providers.

### Offline / synthetic data

```bash
FORECAST_DATA_SOURCE=sample npm run dev
```

Every page shows a "Sample data — not a real forecast" banner.

### API failure handling

1. Start once with live data so the cache is populated, then stop the server.
2. Point the marine API at an unreachable host and make the cache look old:
   ```bash
   OPEN_METEO_MARINE_URL=http://127.0.0.1:9/marine REFRESH_HOURS_UTC=0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23 npm run dev
   ```
3. Pages show the amber "Showing the last available forecast" banner, and `/api/health` reports `"status": "stale"` and `"degraded": true`.
4. Delete `.forecast-cache/` and reload. Pages now show "Forecast temporarily unavailable" and `/api/health` returns 503. Only one failed attempt is made per `REFRESH_FAILURE_BACKOFF_SECONDS`.

### Scheduled refresh

```bash
CRON_SECRET=test npm run dev
curl -i localhost:3000/api/cron/refresh                                    # 401
curl -s -H "Authorization: Bearer test" localhost:3000/api/cron/refresh    # {"refreshed":false,...} when fresh
curl -s -H "Authorization: Bearer test" "localhost:3000/api/cron/refresh?force=1"
```

### Performance and accessibility

```bash
npm run build && npm start
npx lighthouse http://localhost:3000 --preset=desktop --view
npx lighthouse http://localhost:3000/surf/cornwall/fistral --view
```

Points worth checking:
- Leaflet is only downloaded when the map scrolls into view (watch the Network panel).
- No layout shift when the theme script runs (the theme class is applied before first paint).
- All interactive elements are reachable by keyboard; `/` focuses search, and arrow keys and Enter navigate results.

### Embeds

Save this as `embed-test.html`, open it in a browser and check that the iframes resize to fit:

```html
<div data-surf-forecast="/embed/cornwall/fistral"></div>
<div data-surf-forecast="/embed"></div>
<script src="http://localhost:3000/embed.js" async></script>
```
