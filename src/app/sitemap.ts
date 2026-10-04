import type { MetadataRoute } from "next";
import { getActiveRegions, spots } from "@/lib/config";
import { getForecastBundle } from "@/lib/forecast/service";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const bundle = await getForecastBundle();
  const lastModified = bundle.generatedAt > 0 ? new Date(bundle.generatedAt * 1000) : new Date();
  const staticPages = ["/", "/today", "/tomorrow", "/7-day", "/spots", "/regions", "/about"];

  return [
    ...staticPages.map((path) => ({
      url: absoluteUrl(path),
      lastModified,
      changeFrequency: path === "/about" ? ("monthly" as const) : ("hourly" as const),
      priority: path === "/" ? 1 : 0.8,
    })),
    ...getActiveRegions().map((region) => ({
      url: absoluteUrl(`/surf/${region.slug}`),
      lastModified,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    ...spots.map((spot) => ({
      url: absoluteUrl(spot.path),
      lastModified,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
  ];
}
