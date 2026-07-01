import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { toISODate } from "@/lib/utils/date";
import { isPaymentMethod, type PaymentMethod } from "@/lib/utils/payment-method";

export type TransactionVisibility = "all" | "groups" | "private";

export type MonthlyTransaction = {
  id: string;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  spent_at: string;
  memo: string | null;
  /** 결제수단: 신용/체크. null = 미지정(이 컬럼 도입 전 legacy 행). */
  payment_method: PaymentMethod | null;
  /** 할부(installment) 그룹. 일반 거래는 셋 다 null; 할부 자식 행은 같은
   *  installment_id + seq(1..count) + count. 회차금액 = amount. */
  installment_id: string | null;
  installment_seq: number | null;
  installment_count: number | null;
  /** N명 나눠내기(정산). 안 나눈 거래는 둘 다 null; 나눈 거래는 인원(2..4) +
   *  총액(표시용). amount는 항상 내 몫(round(split_total/count))만 담는다. */
  split_count: number | null;
  split_total: number | null;
  visibility: TransactionVisibility;
  /** Group ids linked when visibility === 'groups'. Empty array otherwise.
   *  In friend mode this only contains groups the viewer is a member of (RLS
   *  filters the joined rows); in own mode it's the complete linkage. */
  visible_group_ids: string[];
};

export type MonthlyTransactionsResult =
  | {
      ok: true;
      transactions: MonthlyTransaction[];
      dailyTotals: Record<string, number>;
      monthlyTotal: number;
    }
  | { ok: false; error: string };

type RawRow = {
  id: string;
  amount: number;
  category_id: string | null;
  spent_at: string;
  memo: string | null;
  payment_method: string | null;
  installment_id: string | null;
  installment_seq: number | null;
  installment_count: number | null;
  split_count: number | null;
  split_total: number | null;
  visibility: TransactionVisibility | null;
  transaction_visibility_groups: { group_id: string }[] | null;
  categories: {
    name: string | null;
    icon: string | null;
    color: string | null;
  } | null;
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
        "id, amount, category_id, spent_at, memo, payment_method, installment_id, installment_seq, installment_count, split_count, split_total, visibility, transaction_visibility_groups ( group_id ), categories ( name, icon, color )",
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("spent_at", startIso)
      .lt("spent_at", endIso)
      .order("spent_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return { ok: false, error: error.message };

    const rawRows = (data ?? []) as RawRow[];

    const transactions: MonthlyTransaction[] = rawRows.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      category_id: row.category_id,
      category_name: row.categories?.name ?? null,
      category_icon: row.categories?.icon ?? null,
      category_color: row.categories?.color ?? null,
      spent_at: row.spent_at,
      memo: row.memo,
      payment_method: isPaymentMethod(row.payment_method)
        ? row.payment_method
        : null,
      installment_id: row.installment_id,
      installment_seq: row.installment_seq,
      installment_count: row.installment_count,
      split_count: row.split_count,
      split_total: row.split_total != null ? Number(row.split_total) : null,
      visibility: row.visibility ?? "all",
      visible_group_ids: (row.transaction_visibility_groups ?? []).map(
        (link) => link.group_id,
      ),
    }));

    // Friend-mode backfill: friend RLS hides the owner's CUSTOM category rows,
    // so the `categories(...)` join comes back null for transactions tagged
    // with a custom category (category_id set, category_name null). Fetch the
    // owner's custom category metadata via the get_user_categories RPC (which
    // gates on the friendship) and backfill those rows. In own mode the owner
    // can read their own categories, so this branch never fires (no rows have
    // category_id set with a null name) — the condition is the natural gate
    // that keeps own mode at a single round-trip.
    const needsBackfill = transactions.some(
      (tx) => tx.category_id !== null && tx.category_name === null,
    );
    if (needsBackfill) {
      const { data: customCats } = await supabase.rpc("get_user_categories", {
        target: userId,
      });
      if (customCats) {
        const metaById = new Map(
          customCats.map((cat) => [
            cat.id,
            { name: cat.name, icon: cat.icon, color: cat.color },
          ]),
        );
        for (const tx of transactions) {
          if (tx.category_id !== null && tx.category_name === null) {
            const meta = metaById.get(tx.category_id);
            if (meta) {
              tx.category_name = meta.name;
              tx.category_icon = meta.icon;
              tx.category_color = meta.color;
            }
          }
        }
      }
    }

    const dailyTotals: Record<string, number> = {};
    let monthlyTotal = 0;
    for (const tx of transactions) {
      // Group by local date — spent_at can be a UTC datetime whose UTC date
      // differs from the local date around midnight.
      const day = toISODate(new Date(tx.spent_at));
      dailyTotals[day] = (dailyTotals[day] ?? 0) + tx.amount;
      monthlyTotal += tx.amount;
    }

    return {
      ok: true,
      transactions,
      dailyTotals,
      monthlyTotal,
    };
  },
);
