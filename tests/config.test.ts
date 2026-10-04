import { describe, expect, it } from "vitest";
import regionsJson from "@config/regions.json";
import spotsJson from "@config/spots.json";
import { ConfigError, parseConfig, spots } from "@/lib/config";

describe("spot configuration", () => {
  it("loads every configured spot with friendly URLs and offshore forecast points", () => {
    expect(spots.length).toBeGreaterThanOrEqual(34);
    const fistral = spots.find((spot) => spot.slug === "fistral");
    expect(fistral?.path).toBe("/surf/cornwall/fistral");
    expect(fistral?.orientation).toBe(290);
    expect(fistral?.swell.optimal).toBe(292.5);
    expect(fistral?.marinePoint.lon).toBeLessThan(fistral!.location.lon);
  });

  it("rejects unknown regions", () => {
    const broken = structuredClone(spotsJson);
    broken.spots[0]!.region = "atlantis";
    expect(() => parseConfig(regionsJson, broken)).toThrow(ConfigError);
  });

  it("rejects duplicate slugs", () => {
    const broken = structuredClone(spotsJson);
    broken.spots[1]!.slug = broken.spots[0]!.slug;
    expect(() => parseConfig(regionsJson, broken)).toThrow(/Duplicate spot slug/);
  });

  it("rejects coordinates outside the UK", () => {
    const broken = structuredClone(spotsJson);
    broken.spots[0]!.location.lat = 10;
    expect(() => parseConfig(regionsJson, broken)).toThrow(/location\.lat/);
  });
});
