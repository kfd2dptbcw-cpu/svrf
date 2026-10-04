import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: env.siteName,
    short_name: "Surf Forecast",
    description: "Twice-daily surf forecasts for the UK's best surf spots.",
    start_url: "./",
    display: "standalone",
    background_color: "#04121f",
    theme_color: "#0888b2",
    icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
