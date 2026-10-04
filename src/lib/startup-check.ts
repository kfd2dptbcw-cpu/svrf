/**
 * Configuration checks that must pass before a production build or server
 * starts. Deliberately dependency-free (reads process.env directly, no path
 * aliases) so next.config.ts and instrumentation.ts can both import it.
 */

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

/** Returns human-readable problems; empty when the configuration is usable. */
export function configurationErrors(): string[] {
  const errors: string[] = [];
  const source = process.env.FORECAST_DATA_SOURCE?.trim().toLowerCase();
  const fallback = process.env.FALLBACK_DATA_SOURCE?.trim().toLowerCase();
  const hasKeys = present("XWEATHER_CLIENT_ID") && present("XWEATHER_CLIENT_SECRET");

  if (source === "xweather" && !hasKeys) {
    errors.push(
      "FORECAST_DATA_SOURCE=xweather but XWEATHER_CLIENT_ID and/or XWEATHER_CLIENT_SECRET is missing. " +
        "Set both keys (the app will not silently fall back to Open-Meteo).",
    );
  } else if (fallback === "xweather" && !hasKeys) {
    errors.push("FALLBACK_DATA_SOURCE=xweather but the Xweather keys are missing.");
  } else if (present("XWEATHER_CLIENT_ID") !== present("XWEATHER_CLIENT_SECRET")) {
    errors.push("Only one of XWEATHER_CLIENT_ID / XWEATHER_CLIENT_SECRET is set; both are required.");
  }
  return errors;
}

/** Throw with every problem listed, for use at build/server start. */
export function assertProductionConfiguration(): void {
  const errors = configurationErrors();
  if (errors.length > 0) {
    throw new Error(`Invalid production configuration:\n  - ${errors.join("\n  - ")}`);
  }
}
