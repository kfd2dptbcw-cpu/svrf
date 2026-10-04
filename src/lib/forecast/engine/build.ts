import type {
  DayForecast,
  HourlyConditions,
  SpotForecast,
  SwellComponent,
  TideEvent,
  WindConditions,
} from "@/types/forecast";
import type { MarineSeries, Series, TideSeries, WeatherSeries } from "@/lib/providers/types";
import { ukDateKey, ukTimeParts } from "@/lib/time";
import { round, mean } from "./math";
import { buildSummary } from "./narrative";
import { ratingLabel, scoreHour, scoreToRating } from "./scoring";
import { estimateSurfHeightFt } from "./size";
import { assessSuitability } from "./suitability";
import { findTideEvents, tideStateAt } from "./tide";
import type { EngineSpot } from "./types";
import { classifyWind } from "./wind";
import { findBestWindow } from "./windows";

export interface SpotRawData {
  marine: MarineSeries;
  weather: WeatherSeries | null;
  tide: TideSeries | null;
}

/**
 * Turn raw provider series for one spot into a complete SpotForecast:
 * hourly conditions with scores, then daily summaries, windows and text.
 */
export function buildSpotForecast(slug: string, spot: EngineSpot, raw: SpotRawData, generatedAt: number): SpotForecast {
  const { marine, weather, tide } = raw;
  const weatherIndex = indexByTime(weather?.time ?? []);
  const tideIndex = indexByTime(tide?.time ?? []);
  const tideEvents = tide ? (tide.events ?? findTideEvents(tide.time, tide.height)) : [];
  const daylight = buildDaylightLookup(weather);
  const exposure = { window: spot.swellWindow, optimal: spot.optimalSwell };

  const hourly: HourlyConditions[] = marine.time.map((time, i) => {
    const primarySwell = swellAt(marine.swellHeight, marine.swellPeriod, marine.swellDirection, i);
    const secondarySwell = swellAt(
      marine.secondarySwellHeight,
      marine.secondarySwellPeriod,
      marine.secondarySwellDirection,
      i,
    );
    const w = weatherIndex.get(time);
    const wind = weather && w !== undefined ? windAt(weather, w, spot.offshoreDirection) : null;
    const t = tideIndex.get(time);
    const tideHeight = tide && t !== undefined ? (tide.height[t] ?? null) : null;
    const tideState = tideStateAt(time, tideHeight, tideEvents);

    const size = estimateSurfHeightFt(
      {
        primary: primarySwell,
        secondary: secondarySwell,
        windWaveHeightM: value(marine.windWaveHeight, i),
        totalWaveHeightM: value(marine.waveHeight, i),
        totalWavePeriodS: value(marine.wavePeriod, i),
        totalWaveDirectionDeg: value(marine.waveDirection, i),
      },
      exposure,
      spot.sizeFactor,
    );
    const scored = scoreHour({ faceFt: size.rawFt, primarySwell, wind, tide: tideState }, spot);

    return {
      time,
      isDaylight: daylight(time),
      waveHeightM: roundOrNull(value(marine.waveHeight, i), 2),
      surfMinFt: size.minFt,
      surfMaxFt: size.maxFt,
      primarySwell,
      secondarySwell,
      wind,
      airTempC: weather && w !== undefined ? roundOrNull(value(weather.temperature, w), 1) : null,
      seaTempC: roundOrNull(value(marine.seaSurfaceTemperature, i), 1),
      weatherCode: weather && w !== undefined ? value(weather.weatherCode, w) : null,
      tide: tideState,
      ...scored,
    };
  });

  const days = groupByDay(hourly).map(([date, hours]) => buildDay(date, hours, tideEvents, spot, weather));
  const hasMarineData = hourly.some((hour) => hour.primarySwell !== null || hour.waveHeightM !== null);

  return {
    slug,
    generatedAt,
    hasMarineData,
    days,
    hourly,
    sources: [marine.source, weather?.source, tide?.source].filter((source): source is string => Boolean(source)),
  };
}

function buildDay(
  date: string,
  hours: HourlyConditions[],
  tideEvents: readonly TideEvent[],
  spot: EngineSpot,
  weather: WeatherSeries | null,
): DayForecast {
  const daylightHours = hours.filter((hour) => hour.isDaylight);
  const candidates = daylightHours.length > 0 ? daylightHours : hours;

  // Day score: mean of the three best daylight hours — rewards a solid
  // session rather than a single lucky hour.
  const topScores = candidates.map((hour) => hour.score).sort((a, b) => b - a).slice(0, 3);
  const score = round(mean(topScores), 1);
  const rating = scoreToRating(score);

  const bestWindow = findBestWindow(hours);
  const representative = pickRepresentativeHour(candidates, bestWindow);
  const windowHours = bestWindow
    ? hours.filter((hour) => hour.time >= bestWindow.start && hour.time < bestWindow.end)
    : [representative];

  const temps = hours.map((hour) => hour.airTempC).filter((t): t is number => t !== null);
  const seaTemps = hours.map((hour) => hour.seaTempC).filter((t): t is number => t !== null);
  const dayStart = hours[0]?.time ?? 0;
  const dayEnd = (hours[hours.length - 1]?.time ?? 0) + 3600;
  const sun = weather ? sunTimesForDay(weather, dayStart, dayEnd) : { sunrise: null, sunset: null };

  const surfMinFt = Math.min(...windowHours.map((hour) => hour.surfMinFt));
  const surfMaxFt = Math.max(...windowHours.map((hour) => hour.surfMaxFt));

  return {
    date,
    sunrise: sun.sunrise,
    sunset: sun.sunset,
    score,
    rating,
    label: ratingLabel(rating),
    surfMinFt,
    surfMaxFt,
    primarySwell: representative.primarySwell,
    wind: representative.wind,
    airTempMinC: temps.length ? Math.min(...temps) : null,
    airTempMaxC: temps.length ? Math.max(...temps) : null,
    seaTempC: seaTemps.length ? round(mean(seaTemps), 1) : null,
    weatherCode: representative.weatherCode,
    tideEvents: tideEvents.filter((event) => event.time >= dayStart && event.time < dayEnd),
    bestWindow,
    suitability: assessSuitability(representative, score, spot),
    summary: buildSummary(representative, bestWindow, candidates, { minFt: surfMinFt, maxFt: surfMaxFt }),
  };
}

/** The best hour inside the window, or the best daylight hour overall. */
function pickRepresentativeHour(hours: HourlyConditions[], window: { start: number; end: number } | null): HourlyConditions {
  const pool = window ? hours.filter((hour) => hour.time >= window.start && hour.time < window.end) : [];
  const candidates = pool.length > 0 ? pool : hours;
  const best = candidates.reduce((top, hour) => (hour.score > top.score ? hour : top), candidates[0]!);
  if (best.score > 0) return best;
  return candidates.find((hour) => ukTimeParts(hour.time).hour === 12) ?? best;
}

function groupByDay(hourly: HourlyConditions[]): [string, HourlyConditions[]][] {
  const groups = new Map<string, HourlyConditions[]>();
  for (const hour of hourly) {
    const key = ukDateKey(hour.time);
    const list = groups.get(key);
    if (list) list.push(hour);
    else groups.set(key, [hour]);
  }
  // Drop partial days with too few hours to summarise meaningfully.
  return [...groups.entries()].filter(([, hours]) => hours.length >= 12);
}

function buildDaylightLookup(weather: WeatherSeries | null): (time: number) => boolean {
  const periods = weather
    ? weather.daily.sunrise.map((sunrise, i) => [sunrise, weather.daily.sunset[i] ?? sunrise] as const)
    : [];
  if (periods.length === 0) {
    // No astronomical data: assume 7am–7pm UK time.
    return (time) => {
      const { hour } = ukTimeParts(time);
      return hour >= 7 && hour < 19;
    };
  }
  // An hour counts as daylight if most of it is after sunrise and before sunset.
  return (time) => periods.some(([sunrise, sunset]) => time + 1800 >= sunrise && time + 1800 <= sunset);
}

function sunTimesForDay(weather: WeatherSeries, start: number, end: number) {
  const index = weather.daily.sunrise.findIndex((sunrise) => sunrise >= start && sunrise < end);
  return index === -1
    ? { sunrise: null, sunset: null }
    : { sunrise: weather.daily.sunrise[index] ?? null, sunset: weather.daily.sunset[index] ?? null };
}

function swellAt(height: Series, period: Series, direction: Series, i: number): SwellComponent | null {
  const h = value(height, i);
  const p = value(period, i);
  const d = value(direction, i);
  if (h === null || p === null || d === null || h < 0.05 || p <= 0) return null;
  return { heightM: round(h, 2), periodS: round(p, 1), directionDeg: Math.round(d) };
}

function windAt(weather: WeatherSeries, i: number, offshoreDirection: number): WindConditions | null {
  const speed = value(weather.windSpeed, i);
  const direction = value(weather.windDirection, i);
  if (speed === null || direction === null) return null;
  return {
    speedKmh: round(speed, 1),
    gustKmh: roundOrNull(value(weather.windGusts, i), 1),
    directionDeg: Math.round(direction),
    type: classifyWind(direction, offshoreDirection),
  };
}

function value(series: Series, i: number): number | null {
  const v = series[i];
  return v === undefined || v === null || Number.isNaN(v) ? null : v;
}

function roundOrNull(v: number | null, decimals: number): number | null {
  return v === null ? null : round(v, decimals);
}

function indexByTime(times: readonly number[]): Map<number, number> {
  return new Map(times.map((time, index) => [time, index]));
}
