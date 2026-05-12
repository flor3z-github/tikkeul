import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
