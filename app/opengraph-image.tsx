import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "티끌 - 월 가용 예산 대비 소비를 한눈에 확인하는 개인 PWA";
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
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0A84FF 0%, #007AFF 60%, #0057D9 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "80px",
        }}
      >
        <div
          style={{
            fontSize: 220,
            fontWeight: 800,
            letterSpacing: "-12px",
            lineHeight: 1,
          }}
        >
          티끌
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 40,
            fontWeight: 500,
            opacity: 0.92,
            letterSpacing: "-1px",
            textAlign: "center",
          }}
        >
          이번 달 소비를 확인해요
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 24,
            fontWeight: 400,
            opacity: 0.7,
            letterSpacing: "-0.5px",
          }}
        >
          월 가용 예산 대비 소비율 · 개인용 PWA
        </div>
      </div>
    ),
    { ...size },
  );
}
