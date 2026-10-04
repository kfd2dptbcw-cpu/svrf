import { ImageResponse } from "next/og";
import { getRegion, getSpot, spots } from "@/lib/config";
import { env } from "@/lib/env";
import { getSpotForecast } from "@/lib/forecast/service";
import { todayKey } from "@/lib/forecast/selectors";
import { formatSurfRange } from "@/lib/format";
import { RATING_HEX } from "@/components/forecast/rating-styles";

export const alt = "Surf forecast";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export function generateStaticParams() {
  return spots.map((spot) => ({ region: spot.region, spot: spot.slug }));
}

/** Social card showing today's surf at the spot. */
export default async function SpotOpengraphImage({ params }: { params: Promise<{ region: string; spot: string }> }) {
  const { spot: slug } = await params;
  const spot = getSpot(slug);
  const region = spot ? getRegion(spot.region) : undefined;
  const { forecast } = spot ? await getSpotForecast(spot.slug) : { forecast: null };
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
          color: "white",
          background: "linear-gradient(135deg, #04121f 0%, #0e6c90 65%, #22c8ee 100%)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, opacity: 0.8, letterSpacing: 3, textTransform: "uppercase" }}>{region?.name ?? "UK"}</div>
          <div style={{ fontSize: 84, fontWeight: 700, marginTop: 8 }}>{spot?.name ?? "Surf forecast"}</div>
        </div>
        {today ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 48 }}>
            <div style={{ fontSize: 150, fontWeight: 800, lineHeight: 1 }}>{formatSurfRange(today.surfMinFt, today.surfMaxFt)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 12 }}>
              {/* Drawn stars: text glyphs would make next/og download a web font. */}
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg key={star} width="52" height="52" viewBox="0 0 20 20">
                    <path
                      d="M10 1.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L10 14.9l-5.25 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z"
                      fill={star <= today.rating ? RATING_HEX[today.rating] : "rgba(255,255,255,0.3)"}
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
        <div style={{ fontSize: 28, opacity: 0.85 }}>{env.siteName}</div>
      </div>
    ),
    size,
  );
}
