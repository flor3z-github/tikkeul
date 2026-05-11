import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Skip the auth proxy for static + PWA + SEO assets so unauthenticated
     * crawlers (e.g. KakaoTalk, Twitterbot) don't get redirected to /login
     * when they fetch og:image / manifest / icons:
     *
     * - _next/static, _next/image
     * - favicon.ico
     * - manifest.webmanifest, sw.js, workbox-*, /serwist/* (PWA)
     * - opengraph-image, twitter-image (Next.js auto routes for OG meta)
     * - any path ending in svg/png/jpg/jpeg/gif/webp/woff[2]/ico
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|serwist|sw.js|workbox-.*|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ico)$).*)",
  ],
};
