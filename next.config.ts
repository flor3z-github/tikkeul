import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow extra origins (e.g. a LAN IP for testing on a phone over Wi-Fi)
  // to load Next dev resources like /_next/webpack-hmr. Without this,
  // React Refresh fails silently on the cross-origin LAN URL and client
  // components never hydrate, so onClick handlers don't attach.
  // Set NEXT_DEV_ALLOWED_ORIGINS in .env.local, comma-separated.
  allowedDevOrigins:
    process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [],
  experimental: {
    // Reuse the router cache when navigating back to a recently-visited tab.
    // `dynamic` applies when <Link> has no explicit prefetch prop; `static`
    // applies to prefetch={true}. Server Actions that call revalidatePath
    // (see app/dashboard/actions.ts) still invalidate the cache promptly.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default withSerwist(nextConfig);
