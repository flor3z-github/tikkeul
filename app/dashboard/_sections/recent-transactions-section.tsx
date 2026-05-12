import { redirect } from "next/navigation";

import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import type { TransactionListRow } from "@/components/transactions/transaction-item";
import { getCategories } from "@/lib/queries/categories";
import { createClient } from "@/lib/supabase/server";

type RecentRow = {
  id: string;
  amount: number;
  category_id: string | null;
  spent_at: string;
  categories: { name: string | null; icon: string | null } | null;
};

export async function RecentTransactionsSection() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  const [recentResult, categoriesResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount, category_id, spent_at, categories ( name, icon )")
      .eq("user_id", userId)
      .order("spent_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    getCategories(userId),
  ]);

  if (recentResult.error) {
    return (
      <div className="mt-6 space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">최근 소비를 불러오지 못했어요</p>
        <p className="break-all text-xs opacity-80">
          {recentResult.error.message}
        </p>
      </div>
    );
  }

  if (!categoriesResult.ok) {
    return (
      <div className="mt-6 space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">카테고리를 불러오지 못했어요</p>
        <p className="break-all text-xs opacity-80">{categoriesResult.error}</p>
      </div>
    );
  }

  const recent: TransactionListRow[] = (
    (recentResult.data ?? []) as RecentRow[]
  ).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    category_id: row.category_id,
    category_name: row.categories?.name ?? null,
    category_icon: row.categories?.icon ?? null,
    spent_at: row.spent_at,
  }));

  return (
    <>
      <RecentTransactions
        transactions={recent}
        categories={categoriesResult.categories}
      />
      <AddTransactionButton categories={categoriesResult.categories} />
    </>
  );
}
