import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { resolveNextTarget } from "@/lib/utils/deep-link";

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();
  // getClaims() verifies the JWT against the local JWKS — no Auth API round-trip
  // (unlike getUser()). This "/" landing only needs to know a session exists
  // before bouncing to /dashboard, and RLS still fences every downstream query,
  // so the cheaper local check is correct here. Mirrors lib/supabase/middleware.ts
  // and app/dashboard/page.tsx, which already gate on getClaims().
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  if (!userId) redirect("/login");

  // Push notifications cold-launch the PWA at start_url ("/") with the deep
  // target in `next` (see app/sw.ts) so iOS boots a clean standalone session.
  // resolveNextTarget gates `next` to internal /dashboard + /dm deep-links to
  // avoid an open redirect (see lib/utils/deep-link.ts).
  redirect(resolveNextTarget(next));
}
