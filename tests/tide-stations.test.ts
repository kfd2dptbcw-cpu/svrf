import { describe, expect, it } from "vitest";
import { haversineKm, nearestStation, parseStations } from "@/lib/tide-stations";

/** Hand-made test stations — not real ADMIRALTY station IDs. */
const geojson = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: { type: "Point", coordinates: [-5.083, 50.417] }, properties: { Id: "TEST-A", Name: "Harbour A" } },
    { type: "Feature", geometry: { type: "Point", coordinates: [-5.05, 50.15] }, properties: { Id: "TEST-B", Name: "Harbour B" } },
    { type: "Feature", geometry: { type: "Point", coordinates: [-3.0, 51.0] }, properties: { Id: "TEST-C", Name: "Far Port" } },
    { type: "Feature", geometry: null, properties: { Id: "BROKEN" } },
  ],
};

describe("tide station matching", () => {
  it("parses the GeoJSON /Stations response and skips malformed entries", () => {
    const stations = parseStations(geojson);
    expect(stations.map((s) => s.id)).toEqual(["TEST-A", "TEST-B", "TEST-C"]);
    expect(stations[0]).toMatchObject({ lat: 50.417, lon: -5.083, name: "Harbour A" });
    expect(parseStations({})).toEqual([]);
  });

  it("measures great-circle distance", () => {
    expect(haversineKm(50, -5, 50, -5)).toBe(0);
    expect(haversineKm(50, -5, 51, -5)).toBeCloseTo(111.2, 0);
  });

  it("picks the nearest station without flags when it's close and along the coast", () => {
    const match = nearestStation({ slug: "fistral", lat: 50.417, lon: -5.101, orientation: 290 }, parseStations(geojson));
    expect(match?.station.id).toBe("TEST-A");
    expect(match?.distanceKm).toBeLessThan(2);
    expect(match?.flags).toEqual([]);
  });

  it("flags stations more than 15 km away", () => {
    const match = nearestStation({ slug: "remote", lat: 50.7, lon: -5.6, orientation: 290 }, parseStations(geojson));
    expect(match?.flags.some((flag) => /km away/.test(flag))).toBe(true);
  });

  it("flags stations that lie behind the beach (possible headland or other coast)", () => {
    // A west-facing beach with the nearest station ~9 km due east, inland side.
    const match = nearestStation({ slug: "west-facing", lat: 50.417, lon: -5.21, orientation: 270 }, [
      { id: "EAST", name: "Across the headland", lat: 50.417, lon: -5.083 },
    ]);
    expect(match?.flags).toContain("possibly across a headland / on another stretch of coast");
  });
});
