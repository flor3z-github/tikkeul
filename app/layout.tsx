import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import {
  NavProgressBar,
  NavProgressProvider,
} from "@/components/layout/nav-progress";
import { Toaster } from "@/components/ui/sonner";
import { SerwistProvider } from "./serwist";

const APP_NAME = "티끌";
const APP_DESCRIPTION = "월 가용 예산 대비 소비를 한눈에 확인하는 개인 PWA";

// iOS apple-touch-startup-image: one <link> per iPhone portrait resolution.
// iOS paints the launch splash only when a media query matches the device
// EXACTLY (device-width/height + -webkit-device-pixel-ratio + orientation);
// unmatched devices fall back to the blank background_color screen. The PNGs
// are produced by `pnpm gen:splash` (scripts/gen-splash.mjs) — keep this list
// and that script's DEVICES array in sync.
const APPLE_SPLASH_DEVICES = [
  { cssW: 375, cssH: 667, dpr: 2 }, // SE 2/3, 8, 7, 6s, 6
  { cssW: 414, cssH: 736, dpr: 3 }, // 8 Plus, 7 Plus, 6s Plus
  { cssW: 375, cssH: 812, dpr: 3 }, // X, XS, 11 Pro, 12/13 mini
  { cssW: 414, cssH: 896, dpr: 2 }, // XR, 11
  { cssW: 414, cssH: 896, dpr: 3 }, // XS Max, 11 Pro Max
  { cssW: 390, cssH: 844, dpr: 3 }, // 12, 12 Pro, 13, 13 Pro, 14
  { cssW: 428, cssH: 926, dpr: 3 }, // 12/13 Pro Max, 14 Plus
  { cssW: 393, cssH: 852, dpr: 3 }, // 14 Pro, 15, 15 Pro, 16
  { cssW: 430, cssH: 932, dpr: 3 }, // 14 Pro Max, 15 Plus
  { cssW: 402, cssH: 874, dpr: 3 }, // 16 Pro
  { cssW: 440, cssH: 956, dpr: 3 }, // 16 Pro Max
] as const;

const appleStartupImages = APPLE_SPLASH_DEVICES.map(({ cssW, cssH, dpr }) => ({
  url: `/splash/splash-${cssW * dpr}x${cssH * dpr}.png`,
  media: `(device-width: ${cssW}px) and (device-height: ${cssH}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}));

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
    startupImage: appleStartupImages,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  // Favicon and apple-touch-icon are auto-wired by app/icon.png and
  // app/apple-icon.png. og:image / twitter:image come from app/opengraph-image.tsx.
  // Manifest icons (192/512) are declared in app/manifest.ts.
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-dvh antialiased">
        <NavProgressProvider>
          <NavProgressBar />
          <SerwistProvider swUrl="/serwist/sw.js">{children}</SerwistProvider>
        </NavProgressProvider>
        <Toaster richColors position="top-center" />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
