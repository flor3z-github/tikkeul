import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import {
  NavProgressBar,
  NavProgressProvider,
} from "@/components/layout/nav-progress";
import { Toaster } from "@/components/ui/sonner";
import { SerwistProvider } from "./serwist";

const APP_NAME = "티끌";
const APP_DESCRIPTION = "월 가용 예산 대비 소비를 한눈에 확인하는 개인 PWA";

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
        <Toaster richColors closeButton position="top-center" />
        <Analytics />
      </body>
    </html>
  );
}
