import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { toISODate } from "@/lib/utils/date";

export type MonthlyTransactionReaction = {
  user_id: string;
  emoji: string;
  created_at: string;
};

export type MonthlyTransactionComment = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
};

export type MonthlyTransaction = {
  id: string;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  spent_at: string;
  memo: string | null;
  reactions: MonthlyTransactionReaction[];
  comments: MonthlyTransactionComment[];
};

export type MonthlyTransactionsResult =
  | {
      ok: true;
      transactions: MonthlyTransaction[];
      dailyTotals: Record<string, number>;
      monthlyTotal: number;
      /** Distinct user_ids referenced by reactions/comments — feeds the
       *  profile fetch on the page so the sheet can render nicknames. */
      interactionUserIds: string[];
    }
  | { ok: false; error: string };

type RawRow = {
  id: string;
  amount: number;
  category_id: string | null;
  spent_at: string;
  memo: string | null;
  categories: { name: string | null; icon: string | null } | null;
};

type RawReactionRow = {
  transaction_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

type RawCommentRow = {
  id: string;
  transaction_id: string;
  author_id: string;
  content: string;
  created_at: string;
};

// React `cache()` dedups within a single request so multiple sections
// (summary / calendar / day list) share one Supabase round-trip. The range is
// passed as ISO strings (not Date objects) so the cache key stays stable.
export const getMonthlyTransactions = cache(
  async (
    userId: string,
    startIso: string,
    endIso: string,
  ): Promise<MonthlyTransactionsResult> => {
    if (!startIso || !endIso) {
      return { ok: false, error: "잘못된 주기 범위입니다." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id, amount, category_id, spent_at, memo, categories ( name, icon )",
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("spent_at", startIso)
      .lt("spent_at", endIso)
      .order("spent_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return { ok: false, error: error.message };

    const rawRows = (data ?? []) as RawRow[];
    const txIds = rawRows.map((row) => row.id);

    // Reactions + comments fetched in parallel. Empty txIds means we skip
    // both — Postgres `IN ()` is a syntax error in some clients and an empty
    // round-trip is wasted anyway.
    let reactionRows: RawReactionRow[] = [];
    let commentRows: RawCommentRow[] = [];
    if (txIds.length > 0) {
      const [reactionsRes, commentsRes] = await Promise.all([
        supabase
          .from("transaction_reactions")
          .select("transaction_id, user_id, emoji, created_at")
          .in("transaction_id", txIds),
        supabase
          .from("transaction_comments")
          .select("id, transaction_id, author_id, content, created_at")
          .in("transaction_id", txIds)
          .order("created_at", { ascending: true }),
      ]);
      if (reactionsRes.error) {
        return { ok: false, error: reactionsRes.error.message };
      }
      if (commentsRes.error) {
        return { ok: false, error: commentsRes.error.message };
      }
      reactionRows = (reactionsRes.data ?? []) as RawReactionRow[];
      commentRows = (commentsRes.data ?? []) as RawCommentRow[];
    }

    const reactionsByTx = new Map<string, MonthlyTransactionReaction[]>();
    for (const row of reactionRows) {
      const list = reactionsByTx.get(row.transaction_id) ?? [];
      list.push({
        user_id: row.user_id,
        emoji: row.emoji,
        created_at: row.created_at,
      });
      reactionsByTx.set(row.transaction_id, list);
    }

    const commentsByTx = new Map<string, MonthlyTransactionComment[]>();
    for (const row of commentRows) {
      const list = commentsByTx.get(row.transaction_id) ?? [];
      list.push({
        id: row.id,
        author_id: row.author_id,
        content: row.content,
        created_at: row.created_at,
      });
      commentsByTx.set(row.transaction_id, list);
    }

    const transactions: MonthlyTransaction[] = rawRows.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      category_id: row.category_id,
      category_name: row.categories?.name ?? null,
      category_icon: row.categories?.icon ?? null,
      spent_at: row.spent_at,
      memo: row.memo,
      reactions: reactionsByTx.get(row.id) ?? [],
      comments: commentsByTx.get(row.id) ?? [],
    }));

    const dailyTotals: Record<string, number> = {};
    let monthlyTotal = 0;
    for (const tx of transactions) {
      // Group by local date — spent_at can be a UTC datetime whose UTC date
      // differs from the local date around midnight.
      const day = toISODate(new Date(tx.spent_at));
      dailyTotals[day] = (dailyTotals[day] ?? 0) + tx.amount;
      monthlyTotal += tx.amount;
    }

    const interactionUsers = new Set<string>();
    for (const row of reactionRows) interactionUsers.add(row.user_id);
    for (const row of commentRows) interactionUsers.add(row.author_id);

    return {
      ok: true,
      transactions,
      dailyTotals,
      monthlyTotal,
      interactionUserIds: Array.from(interactionUsers),
    };
  },
);
