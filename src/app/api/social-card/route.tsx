import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { todayKey } from "@/lib/forecast/selectors";
import { getForecastBundle } from "@/lib/forecast/service";
import { formatFullDate, formatSurfRange } from "@/lib/format";
import { ogFonts } from "@/lib/og-fonts";
import { conditionsDetail, pickFeaturedSpots } from "@/lib/social/daily-post";

export const dynamic = "force-dynamic";

/** 4:5 portrait: the largest Instagram feed shape, and it looks right on Facebook too. */
const SIZE = { width: 1080, height: 1350 };
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const INK = "#0B0D0E";
const SLATE = "#4A5459";
const FOG = "#8E9A9C";
const SEAFOAM = "#CFDBDA";
const CHALK = "#EFEEE7";
const FLAG = "#FF4E1F";

function Stars({ rating, size }: { rating: number; size: number }) {
  // Drawn stars: text glyphs would make next/og download a web font.
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width={size} height={size} viewBox="0 0 20 20">
          <path
            d="M10 1.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L10 14.9l-5.25 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z"
            fill={star <= rating ? FLAG : SLATE}
          />
        </svg>
      ))}
    </div>
  );
}

/**
 * Daily "best surf" image for social posts: the top three spots for a day.
 *
 *   /api/social-card                      today, PNG
 *   /api/social-card?date=2026-11-03      a given UK date
 *   &format=jpeg                          JPEG (Instagram's API only accepts JPEG)
 *
 * Reads the forecast cache only, like every other page.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const dateParam = params.get("date");
  if (dateParam && !DATE_KEY.test(dateParam)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const dateKey = dateParam ?? todayKey();
  const bundle = await getForecastBundle();
  const featured = pickFeaturedSpots(bundle, dateKey);
  const host = new URL(env.siteUrl).host;

  const image = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 72, color: CHALK, background: INK }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontFamily: "Archivo Black", fontSize: 56, lineHeight: 1 }}>SVRF</div>
            <div style={{ width: 14, height: 48, background: FLAG }} />
          </div>
          <div style={{ fontSize: 30, color: FOG }}>{formatFullDate(dateKey)}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
          <div style={{ fontSize: 30, color: FOG, letterSpacing: 4, textTransform: "uppercase" }}>UK surf forecast</div>
          <div style={{ fontFamily: "Archivo Black", fontSize: 92, lineHeight: 1.05, marginTop: 8 }}>Best surf today</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 56, flexGrow: 1 }}>
          {featured.length === 0 ? (
            <div style={{ fontSize: 44, color: SEAFOAM }}>Flat across the UK today. Time to wax the board.</div>
          ) : (
            featured.map(({ spot, regionName, day }, index) => (
              <div
                key={spot.slug}
                style={{ display: "flex", alignItems: "center", gap: 32, padding: "28px 32px", borderRadius: 24, background: "#15191B", border: `2px solid ${index === 0 ? FLAG : "#22282B"}` }}
              >
                <div style={{ display: "flex", fontFamily: "Archivo Black", fontSize: 64, color: index === 0 ? FLAG : SLATE, width: 56 }}>{index + 1}</div>
                <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 6 }}>
                  <div style={{ display: "flex", fontSize: 24, color: FOG, letterSpacing: 2, textTransform: "uppercase" }}>{regionName}</div>
                  <div style={{ display: "flex", fontFamily: "Archivo Black", fontSize: 50, lineHeight: 1.05 }}>{spot.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
                    <Stars rating={day.rating} size={32} />
                    <div style={{ display: "flex", fontSize: 28, color: SEAFOAM }}>{day.label}</div>
                  </div>
                  <div style={{ display: "flex", fontSize: 26, color: SEAFOAM, marginTop: 2 }}>{conditionsDetail(day)}</div>
                </div>
                <div style={{ display: "flex", fontFamily: "Archivo Black", fontSize: 72, lineHeight: 1 }}>{formatSurfRange(day.surfMinFt, day.surfMaxFt)}</div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 40 }}>
          <div style={{ fontSize: 32, fontWeight: 600 }}>{`Every spot → ${host}`}</div>
          <div style={{ fontSize: 26, color: FOG }}>Updated daily</div>
        </div>
      </div>
    ),
    { ...SIZE, fonts: await ogFonts() },
  );

  const headers = { "Cache-Control": "public, max-age=600, s-maxage=3600" };
  if (params.get("format") !== "jpeg") {
    return new Response(image.body, { headers: { ...headers, "Content-Type": "image/png" } });
  }
  const { default: sharp } = await import("sharp");
  const jpeg = await sharp(Buffer.from(await image.arrayBuffer())).jpeg({ quality: 90 }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { ...headers, "Content-Type": "image/jpeg" } });
}
