import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS shell for the SVRF forecast. The app loads the live site
 * (forecast.svrf.uk) so every deploy updates the app without an App Store
 * release; ios-shell/index.html is only the offline fallback.
 */
const config: CapacitorConfig = {
  appId: "uk.svrf.forecast",
  appName: "SVRF Forecast",
  webDir: "ios-shell",
  server: {
    url: "https://forecast.svrf.uk",
    cleartext: false,
    allowNavigation: ["forecast.svrf.uk", "svrf.uk", "*.svrf.uk"],
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#0B0D0E",
  },
};

export default config;
