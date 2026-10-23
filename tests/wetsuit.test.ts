import { describe, expect, it } from "vitest";
import { afterSessionKit, pickWetsuit } from "@/lib/forecast/engine/wetsuit";

const calm = { airTempC: 15, windSpeedKmh: 10 };

describe("wetsuit picker", () => {
  it("returns null without a sea temperature", () => {
    expect(pickWetsuit({ seaTempC: null, ...calm })).toBeNull();
  });

  it("matches the blog guidance across the year", () => {
    expect(pickWetsuit({ seaTempC: 15, ...calm })!.suit).toBe("4/3mm"); // Sept-Oct
    expect(pickWetsuit({ seaTempC: 12, ...calm })!.suit).toBe("5/4mm"); // Nov-Dec
    const deep = pickWetsuit({ seaTempC: 7, ...calm })!; // Jan-Mar
    expect(deep).toMatchObject({ suit: "5/4mm", boots: "5mm", gloves: "3mm", hood: true });
  });

  it("goes lighter in warm water", () => {
    expect(pickWetsuit({ seaTempC: 17, ...calm })!.suit).toBe("3/2mm");
    expect(pickWetsuit({ seaTempC: 19, ...calm })!.suit).toBe("shorty");
  });

  it("builds a readable headline", () => {
    expect(pickWetsuit({ seaTempC: 7, ...calm })!.headline).toBe("5/4mm wetsuit, boots, gloves & hood");
    expect(pickWetsuit({ seaTempC: 12, ...calm })!.headline).toBe("5/4mm wetsuit & boots");
    expect(pickWetsuit({ seaTempC: 15, ...calm })!.headline).toBe("4/3mm wetsuit");
  });

  it("steps one band colder in cold wind, only when air is cold and wind is up", () => {
    const windy = pickWetsuit({ seaTempC: 14.5, airTempC: 6, windSpeedKmh: 35 })!;
    expect(windy.windChillBump).toBe(true);
    expect(windy.suit).toBe("5/4mm");
    expect(pickWetsuit({ seaTempC: 14.5, airTempC: 6, windSpeedKmh: 10 })!.windChillBump).toBe(false);
    expect(pickWetsuit({ seaTempC: 14.5, airTempC: 18, windSpeedKmh: 35 })!.windChillBump).toBe(false);
  });

  it("only suggests warm dry kit when it is cold", () => {
    const cold = afterSessionKit(pickWetsuit({ seaTempC: 8, ...calm })!).map((i) => i.slug);
    expect(cold).toEqual(["changing-mat-towel", "fisherman-beanie", "svrf-core-hood"]);
    const warm = afterSessionKit(pickWetsuit({ seaTempC: 18, ...calm })!).map((i) => i.slug);
    expect(warm).toEqual(["changing-mat-towel"]);
  });
});
