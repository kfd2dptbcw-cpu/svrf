# Forecast algorithm

The engine lives in `src/lib/forecast/engine/`. It is made of pure functions with no I/O, and every module is unit tested in `tests/`. This page summarises the reasoning; the source comments carry the detail.

## 1. Inputs

For each spot the providers supply hourly series of:

| Data | Source (default) |
| --- | --- |
| Primary and secondary swell height, period and direction | Open-Meteo Marine (Météo-France MFWAM, ECMWF WAM, NOAA WaveWatch III) |
| Wind-wave height, combined wave height | Open-Meteo Marine |
| Sea surface temperature, sea level (tide) | Open-Meteo Marine |
| Wind speed, gusts and direction, air temperature, weather code, sunrise and sunset | Open-Meteo Weather (UK Met Office UKV, `ukmo_seamless`) |
| High and low water (optional) | ADMIRALTY UK Tidal API |

Marine data is requested at a point `offshoreDistanceKm` (default 6 km) out to sea along the beach's orientation. This keeps the model grid cell off the land mask. You can override it per spot with `forecastPoint`.

## 2. Surf size (`size.ts`)

Wave models forecast deep-water significant height (Hs). Surfers want the breaking face height at the beach:

```
faceFt = Hs(ft) × periodFactor(T) × directionFactor(dir) × sizeFactor
```

- **periodFactor** rises from 0.6 at 5 s to 1.5 at 16 s. Long-period groundswell shoals and breaks bigger than short-period windswell of the same height.
- **directionFactor** is 1.0 at the spot's optimal swell direction and falls to 0.75 at the edges of its swell window. Outside the window it decays to 0.1 over 45°.
- **sizeFactor** is a per-spot calibration from the config.

Swell trains (primary, secondary, and wind sea at half weight) are combined by root-sum-of-squares, which is how independent wave energies add. The displayed range is roughly 70%–100% of the face height (average waves to sets), rounded to whole feet.

## 3. Wind (`wind.ts`)

The spot's ideal offshore direction is the circular mean of its `wind.preferred` directions, or the opposite of `orientation` if none are given. The angle between the actual wind and that ideal sets the type:

| Angle | Type |
| --- | --- |
| 0°–30° | Offshore |
| 30°–65° | Cross-offshore |
| 65°–115° | Cross-shore |
| > 115° | Onshore |

Each type has a base quality (offshore 1.0, cross-offshore 0.85, cross-shore 0.55, onshore 0.3), which a strength curve then reduces. Under 5 km/h it is glassy and scores 1.0 whatever the direction.

## 4. Tide (`tide.ts`)

Turning points are found in the hourly sea-level series and refined with a parabolic fit, which gives better than hourly precision. Each hour is classed as **low**, **mid** or **high** by where it falls between the surrounding low and high water (bottom, middle or top third). It is **rising** or **falling** depending on whether the next event is a high or a low. Event-only sources (ADMIRALTY) are turned into an hourly curve by cosine interpolation.

## 5. Hourly score (`scoring.ts`)

```
quality = (0.38·size + 0.20·period + 0.32·wind + 0.10·direction) × tideFactor
score   = 10 × quality^1.6            (0–10)
```

| Component | 0–1 score |
| --- | --- |
| size | 0 when ≤ 1 ft; rises to 0.55 at the spot's minimum working size and peaks at 1.0 at the sweet spot, 60% through `waveRangeFt`; 0.85 at the top of the range, then falls as the spot maxes out |
| period | 5 s → 0, 7 s → 0.3, 9 s → 0.55, 11 s → 0.75, 13 s → 0.9, 15 s+ → 1.0 (×0.7 below the spot's `minPeriod`) |
| wind | see above |
| direction | directionFactor rescaled to 0–1 |
| tideFactor | 1 on an ideal tide, otherwise `1 − 0.6 × sensitivity` |

The exponent stretches the top of the scale, so Excellent and Epic need every factor to be good.

**Gates** stop one good factor from hiding a fatal flaw:
- ≤ 1 ft of surf: capped at 1.0 (Poor)
- under 2 ft, well below the spot's range, or blown-out wind: capped at 4.4 (Fair)
- under 4 ft: capped at 8.4 (Excellent). Epic needs genuine size.

| Score | Stars | Label |
| --- | --- | --- |
| < 2.5 | ★ | Poor |
| 2.5–4.5 | ★★ | Fair |
| 4.5–6.5 | ★★★ | Good |
| 6.5–8.5 | ★★★★ | Excellent |
| ≥ 8.5 | ★★★★★ | Epic |

## 6. Daily summary (`build.ts`, `windows.ts`, `suitability.ts`, `narrative.ts`)

- **Day score** is the mean of the three best daylight hours. It rewards a solid session, not one lucky hour.
- **Best surf window:** start at the peak daylight hour and grow towards the better neighbour while hours stay within 1.2 points of the peak (and at least Fair). The window is capped at 6 hours. If the peak is below Fair there is no window.
- **Skill suitability** uses the best hour's conditions:
  - *Beginner:* 1–3 ft and no strong wind, at beginner-friendly beaches only (never reefs).
  - *Intermediate:* 2–7 ft, with quality deciding Ideal or Good.
  - *Advanced:* 4 ft+ and Excellent for Ideal; small surf is Marginal.
- **Written forecast:** size and texture ("4-5ft clean surf."), swell ("Long-period WNW swell (1.6m at 13s)."), wind ("Light offshore easterly winds."), any wind change later in the day, and the window ("Best between 7am–11am around mid tide on the push.").

## Tuning

- **Spot-specific behaviour:** edit `config/spots.json` (`sizeFactor`, `waveRangeFt`, swell window, preferred winds, tide sensitivity).
- **Global behaviour:** edit the constants at the top of each engine module (`WEIGHTS`, `QUALITY_EXPONENT`, `RATING_THRESHOLDS`, the period and wind curves). Run `npm test` afterwards. The scoring tests check that clean groundswell rates highly and onshore slop rates poorly.
