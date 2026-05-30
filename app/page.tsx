import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Push notifications cold-launch the PWA at start_url ("/") with the deep
  // target in `next` (see app/sw.ts) so iOS boots a clean standalone session.
  // Forward only internal /dashboard deep-links to avoid an open redirect.
  const target =
    next && /^\/dashboard(?:[/?#]|$)/.test(next) ? next : "/dashboard";
  redirect(target);
}
