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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Push notifications cold-launch the PWA at start_url ("/") with the deep
  // target in `next` (see app/sw.ts) so iOS boots a clean standalone session.
  // resolveNextTarget gates `next` to internal /dashboard + /dm deep-links to
  // avoid an open redirect (see lib/utils/deep-link.ts).
  redirect(resolveNextTarget(next));
}
