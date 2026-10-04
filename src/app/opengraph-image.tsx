import { ImageResponse } from "next/og";
import { spots } from "@/lib/config";
import { env } from "@/lib/env";

export const alt = "UK Surf Forecast — daily surf reports for UK beaches";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          color: "white",
          background: "linear-gradient(135deg, #04121f 0%, #0e6c90 60%, #22c8ee 100%)",
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.8, letterSpacing: 4, textTransform: "uppercase" }}>Updated twice daily</div>
        <div style={{ fontSize: 88, fontWeight: 700, marginTop: 16 }}>{env.siteName}</div>
        <div style={{ fontSize: 36, marginTop: 24, opacity: 0.9 }}>
          {`Wave height, swell, wind, tides and star ratings for ${spots.length} UK surf spots`}
        </div>
      </div>
    ),
    size,
  );
}
