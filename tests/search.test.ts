import { describe, expect, it } from "vitest";
import { matchScore, normaliseSearchText } from "@/lib/search";

describe("spot search", () => {
  it("ignores accents, apostrophes and case", () => {
    expect(normaliseSearchText("Llŷn Hell's")).toBe("llyn hells");
  });

  it("ranks name prefixes above word and region matches", () => {
    expect(matchScore("fis", "Fistral Beach", "Cornwall")).toBe(4);
    expect(matchScore("hell", "Porth Neigwl (Hell's Mouth)", "North Wales")).toBe(3);
    expect(matchScore("corn", "Fistral Beach", "Cornwall")).toBe(1);
    expect(matchScore("zzz", "Fistral Beach", "Cornwall")).toBe(0);
  });
});
