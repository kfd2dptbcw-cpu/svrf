import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";
import type { NextConfig } from "next";
import { assertProductionConfiguration } from "./src/lib/startup-check";

/**
 * Pages are embeddable only from origins listed in EMBED_ALLOWED_ORIGINS
 * (space-separated CSP sources, e.g. "https://www.example.com"). Widgets under
 * /embed default to being embeddable anywhere.
 */
const siteFrameAncestors = process.env.FRAME_ANCESTORS?.trim() || "'self'";
const embedFrameAncestors = process.env.EMBED_ALLOWED_ORIGINS?.trim() || "*";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const basePath = process.env.NEXT_BASE_PATH?.replace(/\/$/, "") || "";

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  poweredByHeader: false,
  reactStrictMode: true,
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Open Graph images read this font file at runtime; keep it in standalone builds.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff"],
  },
  async headers() {
    return [
      {
        source: "/((?!embed).*)",
        headers: [...securityHeaders, { key: "Content-Security-Policy", value: `frame-ancestors ${siteFrameAncestors}` }],
      },
      {
        source: "/embed/:path*",
        headers: [...securityHeaders, { key: "Content-Security-Policy", value: `frame-ancestors ${embedFrameAncestors}` }],
      },
      {
        source: "/embed",
        headers: [...securityHeaders, { key: "Content-Security-Policy", value: `frame-ancestors ${embedFrameAncestors}` }],
      },
      {
        source: "/embed.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }, { key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

/** Production builds and servers fail fast on an unusable provider configuration. */
export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER) assertProductionConfiguration();
  return nextConfig;
}
