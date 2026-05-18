// supabase/functions/notify-dm-message/index.ts
//
// Triggered by a Database Webhook on INSERT into public.dm_messages. The
// recipient — i.e. the non-sender member of the message's thread — gets a
// push notification if their `transaction_interaction_notifications` flag is
// on. This function replaces the deleted notify-transaction-interaction
// function, which targeted the now-dropped transaction_reactions /
// transaction_comments tables (see migration 0037).
//
// Payload shape mirrors notify-friend-spending so the service worker can
// reuse the same first-line-is-nickname convention:
//   { title: <sender nickname>, body, url: /dm/<senderId>, tag }
//
// Emoji-only messages render as "<emoji>로 반응했어요"; everything else uses
// a length-capped preview. We don't reach for an emoji segmenter — checking
// for Extended_Pictographic + variation selectors / ZWJ is good enough for
// the curated reaction set the transaction sheet sends.
//
// Deploy:
//   supabase functions deploy notify-dm-message --no-verify-jwt
//
// Requires the same VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT env
// vars as notify-friend-spending.

// @ts-expect-error - Deno-style JSR import resolved at deploy time.
import { createClient } from "jsr:@supabase/supabase-js@2";
// @ts-expect-error - npm specifier resolved by Deno at deploy time.
import webpush from "npm:web-push@^3.6";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type DmMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  quoted_transaction_id: string | null;
  created_at: string;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: DmMessageRow;
  old_record: DmMessageRow | null;
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Matches strings composed only of emoji code points (with the variation
// selectors and zero-width joiners that compose multi-codepoint emoji). The
// dashboard reuses the same predicate for chunky rendering — keep the two in
// sync if you extend the picker.
const EMOJI_ONLY_RE = /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+$/u;
const MESSAGE_PREVIEW_LIMIT = 30;

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

  if (payload.type !== "INSERT") return ok("skip non-insert");
  if (payload.table !== "dm_messages") return ok("skip unrelated table");

  const record = payload.record;
  const { thread_id, sender_id, content } = record;
  if (!thread_id || !sender_id || !content) {
    return ok("skip missing fields");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Resolve recipient = the non-sender member of the thread.
  const { data: thread, error: threadError } = await supabase
    .from("dm_threads")
    .select("user_a_id, user_b_id")
    .eq("id", thread_id)
    .maybeSingle<{ user_a_id: string; user_b_id: string }>();
  if (threadError) {
    console.error("dm_threads query failed", threadError);
    return ok("thread error");
  }
  if (!thread) return ok("thread not found");
  const recipientId =
    thread.user_a_id === sender_id ? thread.user_b_id : thread.user_a_id;
  if (recipientId === sender_id) return ok("skip self thread");

  // Opt-in check (column from 0035, now repurposed for DM messages — see
  // §12.8.8 in DESIGN.md). Treat missing user_settings as opted out.
  const { data: settingsRow, error: settingsError } = await supabase
    .from("user_settings")
    .select("transaction_interaction_notifications")
    .eq("user_id", recipientId)
    .maybeSingle();
  if (settingsError) {
    console.error("user_settings query failed", settingsError);
    return ok("settings error");
  }
  if (!settingsRow?.transaction_interaction_notifications) {
    return ok("opted out");
  }

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", recipientId);
  if (subsError) {
    console.error("push_subscriptions query failed", subsError);
    return ok("subs error");
  }
  if (!subscriptions || subscriptions.length === 0) {
    return ok("no subscriptions");
  }

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", sender_id)
    .maybeSingle();
  const nickname = (senderProfile?.display_name ?? "").trim() || "친구";

  const trimmedContent = content.trim();
  const isEmojiOnly = EMOJI_ONLY_RE.test(trimmedContent);
  const messagePreview =
    trimmedContent.length > MESSAGE_PREVIEW_LIMIT
      ? `${trimmedContent.slice(0, MESSAGE_PREVIEW_LIMIT)}…`
      : trimmedContent;
  const body = isEmojiOnly
    ? `${trimmedContent}로 반응했어요.`
    : messagePreview;

  const pushBody = JSON.stringify({
    title: nickname,
    body,
    // Deep-link into the recipient's view of the DM thread (route is keyed
    // by the other party's user id).
    url: `/dm/${sender_id}`,
    // Per-thread tag so a burst of reactions / messages collapses into one
    // banner, matching the friend-spend / interaction tag scheme.
    tag: `dm-thread-${thread_id}`,
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint as string,
            keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
          },
          pushBody,
          { TTL: 60 * 60 * 12 },
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
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
