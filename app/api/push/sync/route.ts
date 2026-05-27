import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Same-origin endpoint the service worker POSTs to from the
// `pushsubscriptionchange` handler. A Server Action can't be called from the
// SW, but a fetch to this route carries the auth cookies, so createClient()
// resolves the signed-in user and we can persist the rotated endpoint.
// Mirrors registerPushSubscriptionAction's upsert (endpoint is the unique key).
export async function POST(request: Request) {
  let payload: {
    endpoint?: unknown;
    p256dh?: unknown;
    auth?: unknown;
    userAgent?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const endpoint = typeof payload.endpoint === "string" ? payload.endpoint : "";
  const p256dh = typeof payload.p256dh === "string" ? payload.p256dh : "";
  const auth = typeof payload.auth === "string" ? payload.auth : "";
  const userAgent =
    typeof payload.userAgent === "string" ? payload.userAgent : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, error: "missing subscription fields" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
