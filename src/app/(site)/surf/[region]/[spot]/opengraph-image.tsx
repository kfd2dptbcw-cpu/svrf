import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getRegion, getSpot, spots } from "@/lib/config";
import { env } from "@/lib/env";
import { getSpotForecast } from "@/lib/forecast/service";
import { todayKey } from "@/lib/forecast/selectors";
import { formatSurfRange } from "@/lib/format";
import { ogFonts } from "@/lib/og-fonts";

export const alt = "Surf forecast";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export function generateStaticParams() {
  return spots.map((spot) => ({ region: spot.region, spot: spot.slug }));
}

/** Social card showing today's surf at the spot. */
export default async function SpotOpengraphImage({ params }: { params: Promise<{ region: string; spot: string }> }) {
  const { region: regionSlug, spot: slug } = await params;
  const spot = getSpot(slug);
  const region = getRegion(regionSlug);
  if (!spot || !region || spot.region !== region.slug) notFound();
  const { forecast } = await getSpotForecast(spot.slug);
  const today = forecast?.days.find((day) => day.date >= todayKey());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#EFEEE7",
          background: "#0B0D0E",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, color: "#8E9A9C", letterSpacing: 3, textTransform: "uppercase" }}>{region?.name ?? "UK"}</div>
          <div style={{ fontFamily: "Archivo Black", fontSize: 84, marginTop: 8 }}>{spot?.name ?? "Surf forecast"}</div>
        </div>
        {today ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 48 }}>
            <div style={{ fontFamily: "Archivo Black", fontSize: 150, lineHeight: 1 }}>{formatSurfRange(today.surfMinFt, today.surfMaxFt)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 12 }}>
              {/* Drawn stars: text glyphs would make next/og download a web font. */}
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg key={star} width="52" height="52" viewBox="0 0 20 20">
                    <path
                      d="M10 1.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L10 14.9l-5.25 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z"
                      fill={star <= today.rating ? "#FF4E1F" : "#4A5459"}
                    />
                  </svg>
                ))}
              </div>
              <div style={{ fontSize: 40, fontWeight: 600 }}>{today.label}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 48 }}>Daily surf forecast</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontFamily: "Archivo Black", fontSize: 34 }}>SVRF</div>
          <div style={{ width: 10, height: 30, background: "#FF4E1F" }} />
          <div style={{ fontSize: 26, color: "#CFDBDA" }}>{env.siteName}</div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
