// supabase/functions/notify-transaction-interaction/index.ts
//
// Triggered by Database Webhooks on INSERT into:
//   - public.transaction_reactions
//   - public.transaction_comments
//
// For each insert we notify the OWNER of the underlying transaction (looked
// up via the denormalized `transaction_owner_id` column populated by the
// 0034 trigger). The owner gets the push only when:
//   1. user_settings.transaction_interaction_notifications = true
//   2. the actor (reactor / comment author) is NOT the owner themselves
//
// The payload reuses the same shape as notify-friend-spending:
//   { title: <actor nickname>, body, url, tag }
// — keeping the iOS first-line-is-nickname convention. The body summarizes
// the action ("이모지로 반응했어요." / "댓글을 남겼어요.").
//
// Deploy:
//   supabase functions deploy notify-transaction-interaction --no-verify-jwt
//
// Requires the same VAPID secrets as notify-friend-spending.

// @ts-expect-error - Deno-style JSR import resolved at deploy time.
import { createClient } from "jsr:@supabase/supabase-js@2";
// @ts-expect-error - npm specifier resolved by Deno at deploy time.
import webpush from "npm:web-push@^3.6";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type ReactionRow = {
  transaction_id: string;
  user_id: string;
  emoji: string;
  transaction_owner_id: string;
  created_at: string;
};

type CommentRow = {
  id: string;
  transaction_id: string;
  author_id: string;
  transaction_owner_id: string;
  content: string;
  created_at: string;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: ReactionRow | CommentRow;
  old_record: ReactionRow | CommentRow | null;
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

  if (payload.type !== "INSERT") return ok("skip non-insert");

  const isReaction = payload.table === "transaction_reactions";
  const isComment = payload.table === "transaction_comments";
  if (!isReaction && !isComment) return ok("skip unrelated table");

  const record = payload.record;
  const ownerId = record.transaction_owner_id;
  const actorId = isReaction
    ? (record as ReactionRow).user_id
    : (record as CommentRow).author_id;
  const transactionId = record.transaction_id;

  if (!ownerId || !actorId || !transactionId) return ok("skip missing fields");
  // Self-actions never notify (owner reacting on their own row, or owner
  // commenting on their own row).
  if (actorId === ownerId) return ok("skip self");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Opt-in check: only deliver if the owner has the interaction notification
  // toggle on. Treat a missing user_settings row as opted-out.
  const { data: settingsRow, error: settingsError } = await supabase
    .from("user_settings")
    .select("transaction_interaction_notifications")
    .eq("user_id", ownerId)
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
    .eq("user_id", ownerId);
  if (subsError) {
    console.error("push_subscriptions query failed", subsError);
    return ok("subs error");
  }
  if (!subscriptions || subscriptions.length === 0) {
    return ok("no subscriptions");
  }

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", actorId)
    .maybeSingle();
  const nickname = (actorProfile?.display_name ?? "").trim() || "친구";

  const reactionEmoji = isReaction
    ? ((record as ReactionRow).emoji ?? "").trim()
    : "";
  const reactionBody = reactionEmoji
    ? `내 소비에 ${reactionEmoji} 로 반응했어요.`
    : "내 소비에 이모지로 반응했어요.";

  // Comment body: prepend the meta sentence so the user knows it's a comment
  // event, then append a truncated preview. 10-char threshold matches the
  // user's privacy preference — show enough to hint at the topic without
  // dumping the whole message into the lock-screen banner.
  const commentContent = isComment
    ? ((record as CommentRow).content ?? "").trim()
    : "";
  const COMMENT_PREVIEW_LIMIT = 10;
  const commentPreview =
    commentContent.length > COMMENT_PREVIEW_LIMIT
      ? `${commentContent.slice(0, COMMENT_PREVIEW_LIMIT)}…`
      : commentContent;
  const commentBody = commentPreview
    ? `내 소비에 댓글을 남겼어요. - ${commentPreview}`
    : "내 소비에 댓글을 남겼어요.";

  const body = JSON.stringify({
    title: nickname,
    body: isReaction ? reactionBody : commentBody,
    url: `/dashboard?viewing=${ownerId}`,
    // Per-transaction tag so successive interactions on the same row collapse
    // into one notification, mirroring the friend-spend tag scheme.
    tag: `tx-interaction-${transactionId}`,
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
