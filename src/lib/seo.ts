import type { Metadata } from "next";
import type { RegionConfig, ResolvedSpot } from "@/lib/config";
import { env } from "@/lib/env";

export function absoluteUrl(path = "/"): string {
  return `${env.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Consistent page metadata with canonical URL and Open Graph / Twitter cards. */
export function pageMetadata({
  title,
  description,
  path,
  images,
}: {
  title: string;
  description: string;
  path: string;
  images?: string[];
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: env.siteName,
      locale: "en_GB",
      type: "website",
      ...(images ? { images } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function spotJsonLd(spot: ResolvedSpot, region: RegionConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "Beach",
    name: spot.name,
    description: spot.description,
    url: absoluteUrl(spot.path),
    geo: { "@type": "GeoCoordinates", latitude: spot.location.lat, longitude: spot.location.lon },
    containedInPlace: { "@type": "AdministrativeArea", name: `${region.name}, ${region.country}` },
    publicAccess: true,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: env.siteName,
    url: absoluteUrl("/"),
    inLanguage: "en-GB",
  };
}
