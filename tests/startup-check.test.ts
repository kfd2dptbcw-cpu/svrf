import { afterEach, describe, expect, it, vi } from "vitest";
import { FallbackMarineProvider } from "@/lib/providers/fallback";
import { XweatherMarineProvider } from "@/lib/providers/xweather";
import { assertProductionConfiguration, configurationErrors } from "@/lib/startup-check";

describe("production configuration check", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects FORECAST_DATA_SOURCE=xweather without keys", () => {
    vi.stubEnv("FORECAST_DATA_SOURCE", "xweather");
    vi.stubEnv("XWEATHER_CLIENT_ID", "");
    vi.stubEnv("XWEATHER_CLIENT_SECRET", "");
    expect(configurationErrors()).toHaveLength(1);
    expect(() => assertProductionConfiguration()).toThrow(/XWEATHER_CLIENT_ID/);
  });

  it("rejects a half-configured key pair", () => {
    vi.stubEnv("FORECAST_DATA_SOURCE", "");
    vi.stubEnv("XWEATHER_CLIENT_ID", "id");
    vi.stubEnv("XWEATHER_CLIENT_SECRET", "");
    expect(configurationErrors()[0]).toMatch(/both are required/);
  });

  it("accepts complete Xweather keys and Open-Meteo without keys", () => {
    vi.stubEnv("FORECAST_DATA_SOURCE", "xweather");
    vi.stubEnv("XWEATHER_CLIENT_ID", "id");
    vi.stubEnv("XWEATHER_CLIENT_SECRET", "secret");
    expect(configurationErrors()).toEqual([]);
    vi.stubEnv("FORECAST_DATA_SOURCE", "open-meteo");
    vi.stubEnv("XWEATHER_CLIENT_ID", "");
    vi.stubEnv("XWEATHER_CLIENT_SECRET", "");
    expect(configurationErrors()).toEqual([]);
  });

  it("never falls back to another provider when Xweather keys are missing", async () => {
    vi.stubEnv("XWEATHER_CLIENT_ID", "");
    vi.stubEnv("XWEATHER_CLIENT_SECRET", "");
    const secondary = { id: "open-meteo", fetchMarine: vi.fn().mockResolvedValue({}) };
    const provider = new FallbackMarineProvider(new XweatherMarineProvider(), secondary);
    await expect(provider.fetchMarine([{ slug: "fistral", lat: 50.4, lon: -5.2 }], { days: 1 })).rejects.toThrow(/XWEATHER_CLIENT_ID/);
    expect(secondary.fetchMarine).not.toHaveBeenCalled();
  });
});
