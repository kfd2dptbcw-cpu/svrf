import { env, type DataSource } from "@/lib/env";

/**
 * Human-readable credits for the active data sources, shown in the footer and
 * on the About page. Attribution is a licence requirement for Open-Meteo
 * (CC BY 4.0) and good practice for Xweather.
 */
export interface SourceCredit {
  name: string;
  url: string;
  marine: string;
  weather: string;
}

const CREDITS: Record<Exclude<DataSource, "sample">, SourceCredit> = {
  xweather: {
    name: "Vaisala Xweather",
    url: "https://www.xweather.com/",
    marine: "Vaisala Xweather Maritime API: significant wave height, primary and secondary swell trains, sea surface temperature and tide levels.",
    weather: "Vaisala Xweather Forecasts API: hourly wind, gusts, temperature and weather.",
  },
  "open-meteo": {
    name: "Open-Meteo",
    url: "https://open-meteo.com/",
    marine:
      "Open-Meteo Marine API (CC BY 4.0), blending Météo-France MFWAM, ECMWF WAM and NOAA GFS-Wave (WaveWatch III).",
    weather: "Open-Meteo Weather API (CC BY 4.0) using the UK Met Office UKV model, with a global blend as fallback.",
  },
};

/** Credits for every source the app may use: the primary first, then the fallback. */
export function activeCredits(): SourceCredit[] {
  if (env.dataSource === "sample") return [];
  const credits = [CREDITS[env.dataSource]];
  const fallback = env.fallbackDataSource;
  if (fallback && fallback !== env.dataSource) credits.push(CREDITS[fallback]);
  return credits;
}
