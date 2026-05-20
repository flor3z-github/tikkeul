// supabase/functions/notify-friend-spending/index.ts
//
// Triggered by a Database Webhook on INSERT into public.transactions. For
// every friend (= friendships.viewer_id where owner_id = sender) who has
// opted in via user_settings.friend_spending_notifications, we send a Web
// Push notification containing only the sender's display_name. The payload
// intentionally excludes amount/category to honor DESIGN.md §19 (friend
// privacy: spending details should not leak through a side channel).
//
// Deploy:
//   supabase functions deploy notify-friend-spending --no-verify-jwt
//
// Required secrets:
//   supabase secrets set \
//     VAPID_PUBLIC_KEY=... \
//     VAPID_PRIVATE_KEY=... \
//     VAPID_SUBJECT=mailto:lie9730@gmail.com
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// the Edge Runtime — no need to set them.

// @ts-expect-error - Deno-style JSR import resolved at deploy time.
import { createClient } from "jsr:@supabase/supabase-js@2";
// @ts-expect-error - npm specifier resolved by Deno at deploy time.
import webpush from "npm:web-push@^3.6";

declare const Deno: { env: { get(name: string): string | undefined }; serve: (handler: (req: Request) => Response | Promise<Response>) => void };

type TransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  category_id: string | null;
  spent_at: string;
  memo: string | null;
  visibility: "all" | "groups" | "private" | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: TransactionRow;
  old_record: TransactionRow | null;
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function ok(body = "ok"): Response {
  return new Response(body, { status: 200 });
}

Deno.serve(async (req: Request) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    console.error("VAPID env vars are not configured");
    return ok("vapid not configured");
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase service env vars are missing");
    return ok("supabase env missing");
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return ok("invalid json");
  }

  // Guard: only INSERT, only transactions, only live rows. A soft-delete or
  // update event must never trigger a notification. Private transactions are
  // hidden from friends end-to-end — also skip the push.
  if (payload.type !== "INSERT") return ok("skip non-insert");
  if (payload.table !== "transactions") return ok("skip non-transactions");
  if (payload.record?.deleted_at) return ok("skip soft-deleted");
  const visibility = payload.record?.visibility ?? "all";
  if (visibility === "private") return ok("skip private");

  const senderId = payload.record.user_id;
  if (!senderId) return ok("skip no user_id");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Friendships row direction: owner_id = data owner (sender),
  // viewer_id = who can see the data (recipients of the notification).
  const { data: viewers, error: viewersError } = await supabase
    .from("friendships")
    .select("viewer_id")
    .eq("owner_id", senderId);
  if (viewersError) {
    console.error("friendships query failed", viewersError);
    return ok("friendships error");
  }
  let viewerIds = (viewers ?? []).map((row) => row.viewer_id as string);
  if (viewerIds.length === 0) return ok("no viewers");

  // visibility='groups' narrows the viewer set to friends who belong to a
  // group the tx is linked to. RLS already hides the row from non-members
  // for the in-app dashboard; we mirror that here so the push channel can't
  // leak the existence of a group-only spend to friends outside the group.
  if (visibility === "groups") {
    const { data: tvg, error: tvgError } = await supabase
      .from("transaction_visibility_groups")
      .select("group_id")
      .eq("transaction_id", payload.record.id);
    if (tvgError) {
      console.error("tvg query failed", tvgError);
      return ok("tvg error");
    }
    const groupIds = (tvg ?? []).map((row) => row.group_id as string);
    if (groupIds.length === 0) return ok("groups tx with no links");

    const { data: members, error: membersError } = await supabase
      .from("friend_group_members")
      .select("member_user_id")
      .in("group_id", groupIds)
      .in("member_user_id", viewerIds);
    if (membersError) {
      console.error("friend_group_members query failed", membersError);
      return ok("members error");
    }
    const allowed = new Set(
      (members ?? []).map((row) => row.member_user_id as string),
    );
    viewerIds = viewerIds.filter((id) => allowed.has(id));
    if (viewerIds.length === 0) return ok("no group members among viewers");
  }

  const { data: optedIn, error: settingsError } = await supabase
    .from("user_settings")
    .select("user_id")
    .in("user_id", viewerIds)
    .eq("friend_spending_notifications", true);
  if (settingsError) {
    console.error("user_settings query failed", settingsError);
    return ok("settings error");
  }
  const recipientIds = (optedIn ?? []).map((row) => row.user_id as string);
  if (recipientIds.length === 0) return ok("no opt-in");

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", recipientIds);
  if (subsError) {
    console.error("push_subscriptions query failed", subsError);
    return ok("subs error");
  }
  if (!subscriptions || subscriptions.length === 0) return ok("no subscriptions");

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", senderId)
    .maybeSingle();
  const nickname = (senderProfile?.display_name ?? "").trim() || "친구";

  // Slice the YYYY-MM-DD and YYYY-MM out of spent_at so a tap on the
  // notification lands the recipient on the exact day cell + scrolls to the
  // transaction row. Safe against time zones because spent_at is a plain
  // date-ish value the client wrote (no offset gymnastics on this side).
  const spentAt = payload.record.spent_at ?? "";
  const dayIso = spentAt.slice(0, 10);
  const ymIso = spentAt.slice(0, 7);
  const focusParams = new URLSearchParams({ viewing: senderId });
  if (/^\d{4}-\d{2}$/.test(ymIso)) focusParams.set("ym", ymIso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayIso)) focusParams.set("day", dayIso);
  if (payload.record.id) focusParams.set("focus", payload.record.id);

  // iOS Safari Web Push always appends a "from <manifest.name>" line, so
  // keeping title="티끌" produced visible duplication. Put the sender's
  // nickname in the title slot to use that prominent first line meaningfully.
  const body = JSON.stringify({
    title: nickname,
    body: "소비를 추가했어요",
    url: `/dashboard?${focusParams.toString()}`,
    tag: `friend-spend-${senderId}`,
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint as string,
            keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
          },
          body,
          { TTL: 60 * 60 * 12 },
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404 = endpoint never existed, 410 = unsubscribed at the push service.
        // Either way the row is dead — clean it up so the next round is smaller.
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id as string);
        } else {
          console.error("web-push send failed", { statusCode, err });
        }
      }
    }),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return ok(`sent=${sent} total=${subscriptions.length}`);
});
