import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./database.types";

// "/auth" is reserved for a future Supabase email-confirm / OAuth callback
// route (the redirect URL is configured in the Supabase dashboard). "/offline"
// was removed: there is no /offline route and no offline fallback by design
// (DESIGN.md §16).
const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // With Fluid compute, don't put this client in a global variable. Always
  // create a new one on each request.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: do not run anything between createServerClient and the auth
  // call below. getClaims() verifies the JWT locally via JWKS (no Auth API
  // round-trip), shaving ~100-300ms off every request compared to getUser().
  //
  // Trade-off vs getUser(): a stale token whose signing key is still valid
  // will pass middleware even if the corresponding auth.users row was deleted
  // (e.g. after a database reset). That's acceptable here because every
  // Supabase query is fenced by RLS — a deleted user sees empty pages, not
  // someone else's data. Pages that need hard verification (settings) should
  // still call supabase.auth.getUser() in the server component itself.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  const { pathname } = request.nextUrl;

  if (!userId && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (userId && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: must return the supabaseResponse object as-is so cookies stay
  // in sync between browser and server.
  return supabaseResponse;
}
