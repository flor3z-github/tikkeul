import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { toISODate } from "@/lib/utils/date";

export type MonthlyTransaction = {
  id: string;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  spent_at: string;
  memo: string | null;
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
  categories: { name: string | null; icon: string | null } | null;
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

    const transactions: MonthlyTransaction[] = ((data ?? []) as RawRow[]).map(
      (row) => ({
        id: row.id,
        amount: Number(row.amount),
        category_id: row.category_id,
        category_name: row.categories?.name ?? null,
        category_icon: row.categories?.icon ?? null,
        spent_at: row.spent_at,
        memo: row.memo,
      }),
    );

    const dailyTotals: Record<string, number> = {};
    let monthlyTotal = 0;
    for (const tx of transactions) {
      // Group by local date — spent_at can be a UTC datetime whose UTC date
      // differs from the local date around midnight.
      const day = toISODate(new Date(tx.spent_at));
      dailyTotals[day] = (dailyTotals[day] ?? 0) + tx.amount;
      monthlyTotal += tx.amount;
    }

    return { ok: true, transactions, dailyTotals, monthlyTotal };
  },
);
