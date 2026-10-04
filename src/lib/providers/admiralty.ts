import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http/fetch-json";
import { interpolateTideHeights } from "@/lib/forecast/engine/tide";
import type { TideEvent } from "@/types/forecast";
import { OpenMeteoTideProvider } from "./open-meteo";
import type { ForecastPoint, MarineSeries, ProviderContext, TideProvider, TideSeries } from "./types";

/**
 * UK Hydrographic Office ADMIRALTY UK Tidal API (Discovery tier — free,
 * requires a subscription key from https://admiraltyapi.portal.azure-api.net).
 *
 * Returns official high/low water predictions for a tidal station. Spots opt
 * in by setting `tideStationId` in config/spots.json; spots without a station
 * (or if the API fails) fall back to the modelled Open-Meteo tide.
 */

const BASE_URL = "https://admiraltyapi.azure-api.net/uktidalapi/api/V1";

interface AdmiraltyEvent {
  EventType: "HighWater" | "LowWater";
  DateTime: string;
  Height?: number;
}

export class AdmiraltyTideProvider implements TideProvider {
  readonly id = "admiralty-tide";
  private readonly fallback = new OpenMeteoTideProvider();

  async fetchTides(
    points: (ForecastPoint & { stationId?: string })[],
    context: ProviderContext & { marine: Record<string, MarineSeries> },
  ): Promise<Record<string, TideSeries>> {
    const result = await this.fallback.fetchTides(points, context);
    const apiKey = env.admiraltyApiKey;
    if (!apiKey) return result;

    // Several spots can share a station: fetch each station once.
    const stations = new Map<string, Promise<TideEvent[] | null>>();
    for (const point of points) {
      if (!point.stationId || stations.has(point.stationId)) continue;
      stations.set(point.stationId, this.fetchStation(point.stationId, apiKey, context).catch(() => null));
    }

    for (const point of points) {
      if (!point.stationId) continue;
      const events = await stations.get(point.stationId);
      const marine = context.marine[point.slug];
      if (!events || events.length < 2 || !marine) continue;
      result[point.slug] = {
        time: marine.time,
        height: interpolateTideHeights(events, marine.time),
        events,
        source: "ADMIRALTY UK Tidal API (UKHO)",
      };
    }
    return result;
  }

  private async fetchStation(stationId: string, apiKey: string, context: ProviderContext): Promise<TideEvent[]> {
    const duration = Math.min(Math.max(context.days, 1), 7);
    const events = await fetchJson<AdmiraltyEvent[]>(
      `${BASE_URL}/Stations/${encodeURIComponent(stationId)}/TidalEvents?duration=${duration}`,
      { headers: { "Ocp-Apim-Subscription-Key": apiKey }, label: "ADMIRALTY UK Tidal API", signal: context.signal },
    );
    return events
      .filter((event) => typeof event.Height === "number")
      .map((event) => ({
        // Times are published in UTC without a zone designator.
        time: Math.round(Date.parse(event.DateTime.endsWith("Z") ? event.DateTime : `${event.DateTime}Z`) / 1000),
        type: event.EventType === "HighWater" ? ("high" as const) : ("low" as const),
        heightM: Math.round((event.Height ?? 0) * 100) / 100,
      }))
      .sort((a, b) => a.time - b.time);
  }
}
