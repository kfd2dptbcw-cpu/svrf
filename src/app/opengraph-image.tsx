import { ImageResponse } from "next/og";
import { spots } from "@/lib/config";
import { ogFonts } from "@/lib/og-fonts";

export const alt = "SVRF Surf Forecast — daily surf reports for UK beaches";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          color: "#EFEEE7",
          background: "#0B0D0E",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ fontFamily: "Archivo Black", fontSize: 120, lineHeight: 1 }}>SVRF</div>
          <div style={{ width: 28, height: 96, background: "#FF4E1F" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontFamily: "Archivo Black", fontSize: 64 }}>Surf Forecast</div>
          <div style={{ fontSize: 32, color: "#CFDBDA" }}>
            {`Wave height, swell, wind, tides and star ratings for ${spots.length} UK surf spots. Updated daily.`}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
