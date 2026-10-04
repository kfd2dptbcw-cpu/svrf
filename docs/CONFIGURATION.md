# Configuration reference

Surf spots and regions are defined in JSON under `config/`. Both files are validated with zod when the app starts and at build time. An invalid file fails the build with a clear message, so a typo can't reach production.

```bash
npm run config:validate   # validate, list spots with their marine forecast points, regenerate JSON Schemas
```

## `config/regions.json`

| Field | Type | Notes |
| --- | --- | --- |
| `slug` | string | Lowercase and hyphenated; used in URLs (`/surf/<slug>`) |
| `name` | string | Display name |
| `country` | string | England, Wales, Scotland or Northern Ireland |
| `description` | string | Shown on region pages and used for SEO |

Regions without any enabled spots are hidden automatically.

## `config/spots.json`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | ✔ | Unique and lowercase-hyphenated. The URL is `/surf/<region>/<slug>`. |
| `name` | string | ✔ | Display name |
| `region` | string | ✔ | A region `slug` |
| `location` | `{lat, lon}` | ✔ | The beach itself (used for weather, the map and structured data). Must be within the UK. |
| `forecastPoint` | `{lat, lon}` | | Marine model point. Defaults to `offshoreDistanceKm` out to sea along `orientation`. |
| `offshoreDistanceKm` | number | | Default `6`. Increase it if a spot gets no marine data (grid cell on land). |
| `orientation` | direction | ✔ | Direction the beach **faces**, looking out to sea |
| `breakType` | `beach` · `reef` · `point` · `rivermouth` | ✔ | Reefs are never rated suitable for beginners |
| `skillLevels` | array | ✔ | Any of `beginner`, `intermediate`, `advanced` |
| `swell.window` | `[from, to]` | ✔ | Clockwise arc of swell directions that reach the spot |
| `swell.optimal` | direction | ✔ | Swell direction that produces the best waves |
| `swell.minPeriod` | seconds | | Default `8`. Shorter periods score lower here. |
| `wind.preferred` | direction[] | ✔ | Wind directions (where the wind blows **from**) that groom the waves. Their circular mean is treated as dead offshore. |
| `tide.ideal` | array | ✔ | Any of `low`, `mid`, `high` |
| `tide.sensitivity` | 0–1 | | Default `0.3`. 0 = works on all tides; 1 = only on the ideal tide. |
| `waveRangeFt` | `[min, max]` | ✔ | Typical working range (face height, feet) |
| `sizeFactor` | 0.1–2 | | Default `1`. Below 1 for sheltered spots, above 1 for swell magnets. |
| `description` | string | ✔ | Shown on the spot page and in metadata |
| `hazards` | string[] | | Shown on the spot page |
| `tideStationId` | string | | UKHO station ID, used when `TIDE_PROVIDER=admiralty` |
| `enabled` | boolean | | Default `true`. `false` hides the spot without deleting it. |

**Directions** accept compass points (`"N"`, `"NNE"` … `"NNW"`) or degrees (`0`–`360`).

## Calibration tips

1. Start from a similar spot's settings.
2. Compare the forecast surf height with real observations over a few swells. If it is consistently too big or small, adjust `sizeFactor` in steps of 0.05–0.1.
3. If ratings feel too generous in onshore winds, check that `wind.preferred` really points from land to sea.
4. For spots that only work on certain tides, raise `tide.sensitivity` towards 0.6–0.8.

## Adding official tide predictions

1. Get a free Discovery key at <https://admiraltyapi.portal.azure-api.net/>.
2. Call `GET https://admiraltyapi.azure-api.net/uktidalapi/api/V1/Stations` with your key and find the nearest station to each spot.
3. Add `"tideStationId": "<Id>"` to those spots.
4. Set `TIDE_PROVIDER=admiralty` and `ADMIRALTY_API_KEY=<key>`.

Spots without a station, and any spot whose station request fails, fall back to the modelled tide.
