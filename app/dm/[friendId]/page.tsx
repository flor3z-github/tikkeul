import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { DmChat, type DmChatMessage, type DmChatQuoteCard } from "./_components/dm-chat";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = Promise<{ friendId: string }>;
type SearchParams = Promise<{ quote?: string; message?: string }>;

export default async function DmThreadPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { friendId } = await params;
  if (!UUID_RE.test(friendId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (friendId === user.id) notFound();

  // Confirm a friendship exists in either direction. The RPC below also
  // re-checks this but failing here lets us render a clean notFound rather
  // than a Postgres exception page.
  const { data: friendship } = await supabase
    .from("friendships")
    .select("owner_id, viewer_id")
    .or(
      `and(owner_id.eq.${user.id},viewer_id.eq.${friendId}),and(owner_id.eq.${friendId},viewer_id.eq.${user.id})`,
    )
    .limit(1)
    .maybeSingle();
  if (!friendship) notFound();

  // Resolve / create the canonical thread atomically.
  const { data: threadId, error: threadError } = await supabase.rpc(
    "get_or_create_dm_thread",
    { target: friendId },
  );
  if (threadError || !threadId) {
    return (
      <AppShell>
        <PageHeader title="DM" />
        <p className="mt-6 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
          {threadError?.message ?? "DM 스레드를 만들지 못했어요."}
        </p>
      </AppShell>
    );
  }

  // Mark the caller-side of the thread as read at page enter. Messages that
  // arrive while the user is actively viewing the chat will stay "unread"
  // in the schema until the user re-enters; that's an acceptable v1 gap —
  // the dashboard dot still updates live via the realtime watcher and the
  // /dm index re-renders.
  await supabase.rpc("mark_dm_thread_read", { p_thread_id: threadId });

  // Pull friend nickname for the header.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", friendId)
    .maybeSingle();
  const friendNickname = profile?.display_name ?? "이름 없음";

  // Pull the latest 200 messages. We order DESC at the DB to make `LIMIT`
  // keep the newest window, then reverse in JS so the UI still receives
  // them oldest → newest. RLS already restricts to thread members; real
  // pagination is future work.
  const { data: latestMessages, error: messagesError } = await supabase
    .from("dm_messages")
    .select(
      "id, sender_id, content, quoted_transaction_id, created_at",
    )
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(200);
  const rawMessages = latestMessages ? [...latestMessages].reverse() : [];

  if (messagesError) {
    return (
      <AppShell>
        <PageHeader title={friendNickname} />
        <p className="mt-6 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
          {messagesError.message}
        </p>
      </AppShell>
    );
  }

  // Resolve quoted-tx details in a single batched fetch. We intentionally
  // include soft-deleted rows so the UI can render a "삭제된 소비" stub
  // instead of a blank quote.
  const quotedTxIds = Array.from(
    new Set(
      (rawMessages ?? [])
        .map((m) => m.quoted_transaction_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  let quoteById = new Map<string, DmChatQuoteCard>();
  if (quotedTxIds.length > 0) {
    const { data: txRows } = await supabase
      .from("transactions")
      .select(
        "id, amount, spent_at, memo, deleted_at, categories ( name, icon, color )",
      )
      .in("id", quotedTxIds);
    quoteById = new Map(
      ((txRows ?? []) as Array<{
        id: string;
        amount: number;
        spent_at: string;
        memo: string | null;
        deleted_at: string | null;
        categories: {
          name: string | null;
          icon: string | null;
          color: string | null;
        } | null;
      }>).map((row) => [
        row.id,
        {
          id: row.id,
          amount: Number(row.amount),
          spent_at: row.spent_at,
          memo: row.memo,
          deleted: row.deleted_at !== null,
          category_name: row.categories?.name ?? null,
          category_icon: row.categories?.icon ?? null,
          category_color: row.categories?.color ?? null,
        },
      ]),
    );
  }

  const messages: DmChatMessage[] = (rawMessages ?? []).map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
    quote: row.quoted_transaction_id
      ? (quoteById.get(row.quoted_transaction_id) ?? {
          id: row.quoted_transaction_id,
          amount: 0,
          spent_at: row.created_at,
          memo: null,
          deleted: true,
          category_name: null,
          category_icon: null,
          category_color: null,
        })
      : null,
  }));

  // The transaction sheet's [답장] button sends the viewer here with a
  // ?quote=<txId> param. Resolve that into a quote card the composer can
  // attach to the next outgoing message.
  const sp = await searchParams;
  let prefilledQuote: DmChatQuoteCard | null = null;
  if (sp?.quote && UUID_RE.test(sp.quote)) {
    // The quote can already be in our message-batch map; otherwise fetch it.
    const cached = quoteById.get(sp.quote);
    if (cached) {
      prefilledQuote = cached;
    } else {
      const { data: txRow } = await supabase
        .from("transactions")
        .select(
          "id, amount, spent_at, memo, deleted_at, user_id, categories ( name, icon, color )",
        )
        .eq("id", sp.quote)
        .maybeSingle();
      if (txRow && txRow.user_id === friendId && !txRow.deleted_at) {
        prefilledQuote = {
          id: txRow.id,
          amount: Number(txRow.amount),
          spent_at: txRow.spent_at,
          memo: txRow.memo,
          deleted: false,
          category_name: (
            txRow as unknown as {
              categories: {
                name: string | null;
                icon: string | null;
                color: string | null;
              } | null;
            }
          ).categories?.name ?? null,
          category_icon: (
            txRow as unknown as {
              categories: {
                name: string | null;
                icon: string | null;
                color: string | null;
              } | null;
            }
          ).categories?.icon ?? null,
          category_color: (
            txRow as unknown as {
              categories: {
                name: string | null;
                icon: string | null;
                color: string | null;
              } | null;
            }
          ).categories?.color ?? null,
        };
      }
    }
  }

  // ?message=<uuid> — dashboard comment-trace deep link. The client validates
  // existence against the loaded message batch and falls back to the bottom
  // anchor + toast when it can't find the row (e.g. older than the 200-msg
  // window). We still validate the UUID shape here to keep junk out of the DOM.
  const targetMessageId =
    sp?.message && UUID_RE.test(sp.message) ? sp.message : null;

  return (
    <AppShell withFixedComposer>
      <DmChat
        threadId={threadId}
        viewerId={user.id}
        friendId={friendId}
        friendNickname={friendNickname}
        initialMessages={messages}
        prefilledQuote={prefilledQuote}
        targetMessageId={targetMessageId}
      />
    </AppShell>
  );
}
