import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this project. Without this, Turbopack
  // walks up the tree looking for a lockfile and can latch onto a stray
  // C:\Users\<me>\package-lock.json (left behind by `npx supabase`), making it
  // treat the entire home directory as the root — it then scans/watches all of
  // it, and route compiles (e.g. /login) crawl. `pnpm dev`/`pnpm build` always
  // run from the project root, so process.cwd() is the correct root here.
  turbopack: {
    root: process.cwd(),
  },
  // Allow extra origins (e.g. a LAN IP for testing on a phone over Wi-Fi)
  // to load Next dev resources like /_next/webpack-hmr. Without this,
  // React Refresh fails silently on the cross-origin LAN URL and client
  // components never hydrate, so onClick handlers don't attach.
  // Set NEXT_DEV_ALLOWED_ORIGINS in .env.local, comma-separated.
  allowedDevOrigins:
    process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [],
  // Cache Components (Next 16): subsumes the old `experimental.ppr` flag.
  // Routes become dynamic by default; anything tracked outside a Suspense
  // boundary requires explicit caching via the `use cache` directive. For
  // each Suspense boundary, Next prerenders the fallback as a static shell
  // and streams the dynamic content in — this is what gives the dashboard
  // a near-instant first paint even though the page itself is dynamic.
  cacheComponents: true,
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
