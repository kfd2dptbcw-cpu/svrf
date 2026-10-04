import { describe, expect, it } from "vitest";
import {
  angularDifference,
  circularMean,
  compassToDegrees,
  degreesToCompass,
  destinationPoint,
  directionAdjective,
  distanceOutsideArc,
  isWithinArc,
} from "@/lib/forecast/engine/angles";

describe("angles", () => {
  it("computes the smallest angular difference across north", () => {
    expect(angularDifference(350, 10)).toBe(20);
    expect(angularDifference(90, 270)).toBe(180);
  });

  it("converts between compass points and degrees", () => {
    expect(compassToDegrees("WNW")).toBe(292.5);
    expect(degreesToCompass(292)).toBe("WNW");
    expect(degreesToCompass(359)).toBe("N");
  });

  it("averages bearings on the circle", () => {
    expect(circularMean([350, 10])).toBeCloseTo(0, 5);
    expect(circularMean([90, 180])).toBeCloseTo(135, 5);
  });

  it("handles arcs that wrap through north", () => {
    expect(isWithinArc(10, 270, 45)).toBe(true);
    expect(isWithinArc(180, 270, 45)).toBe(false);
    expect(distanceOutsideArc(90, 270, 45)).toBe(45);
    expect(distanceOutsideArc(300, 270, 45)).toBe(0);
  });

  it("moves a point offshore along a bearing", () => {
    const point = destinationPoint(50.417, -5.101, 270, 6);
    expect(point.lat).toBeCloseTo(50.417, 2);
    expect(point.lon).toBeLessThan(-5.17);
  });

  it("describes wind directions in prose", () => {
    expect(directionAdjective(90)).toBe("easterly");
    expect(directionAdjective(225)).toBe("south-westerly");
  });
});
