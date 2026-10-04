/**
 * Sunrise and sunset from the standard NOAA/suncalc solar position equations.
 * Computed locally so daylight hours never cost an API request and work with
 * any data provider. Accurate to about a minute at UK latitudes.
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;
const J0 = 0.0009;
/** Sun's apparent radius plus atmospheric refraction. */
const SUNRISE_ALTITUDE = -0.833 * RAD;

const toJulian = (ms: number) => ms / DAY_MS - 0.5 + J1970;
const fromJulian = (j: number) => (j + 0.5 - J1970) * DAY_MS;
const toDays = (ms: number) => toJulian(ms) - J2000;

const solarMeanAnomaly = (d: number) => RAD * (357.5291 + 0.98560028 * d);

function eclipticLongitude(M: number) {
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372;
  return M + C + P + Math.PI;
}

const declination = (L: number) => Math.asin(Math.sin(OBLIQUITY) * Math.sin(L));

/**
 * Sunrise and sunset (unix seconds) for the solar day nearest `unixSeconds`
 * at the given location. Returns nulls in polar day/night (never in the UK).
 */
export function sunTimes(unixSeconds: number, lat: number, lon: number): { sunrise: number | null; sunset: number | null } {
  const lw = RAD * -lon;
  const phi = RAD * lat;
  const d = toDays(unixSeconds * 1000);
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const jNoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

  const cosH = (Math.sin(SUNRISE_ALTITUDE) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosH < -1 || cosH > 1) return { sunrise: null, sunset: null };
  const w = Math.acos(cosH);
  const jSet = J2000 + J0 + (w + lw) / (2 * Math.PI) + n + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const jRise = jNoon - (jSet - jNoon);
  return {
    sunrise: Math.round(fromJulian(jRise) / 1000),
    sunset: Math.round(fromJulian(jSet) / 1000),
  };
}

/** Sunrise/sunset for every day spanned by a list of timestamps (sorted). */
export function sunTimesForRange(times: readonly number[], lat: number, lon: number) {
  const sunrise: number[] = [];
  const sunset: number[] = [];
  if (times.length === 0) return { sunrise, sunset };
  const first = times[0]!;
  const last = times[times.length - 1]!;
  // Step from local noon of the first day so each solar day is computed once.
  for (let t = first - (first % 86400) + 43200; t <= last + 86400; t += 86400) {
    const sun = sunTimes(t, lat, lon);
    if (sun.sunrise !== null && sun.sunset !== null && !sunrise.includes(sun.sunrise)) {
      sunrise.push(sun.sunrise);
      sunset.push(sun.sunset);
    }
  }
  return { sunrise, sunset };
}
