import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - manifest.webmanifest / sw.js (PWA assets, added in Phase C)
     * - common image / font extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|serwist|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ico)$).*)",
  ],
};
