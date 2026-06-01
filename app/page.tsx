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
  // Forward only internal /dashboard and /dm deep-links to avoid an open
  // redirect. /dm/* is the DM thread target sent by notify-dm-message (friend
  // reactions/comments); without it those notifications fall back to /dashboard.
  const target =
    next && /^\/(dashboard|dm)(?:[/?#]|$)/.test(next) ? next : "/dashboard";
  redirect(target);
}
