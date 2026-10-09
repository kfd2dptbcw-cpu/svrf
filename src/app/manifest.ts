import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: env.siteName,
    short_name: "SVRF",
    description: "Daily surf forecasts for the UK's best surf spots.",
    start_url: "./",
    display: "standalone",
    background_color: "#0B0D0E",
    theme_color: "#0B0D0E",
    icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
