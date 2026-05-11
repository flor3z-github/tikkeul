import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SpendingSummary } from "@/components/dashboard/spending-summary";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import type { TransactionFormCategory } from "@/components/transactions/transaction-form-dialog";
import type { TransactionListRow } from "@/components/transactions/transaction-item";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { monthEnd, monthStart } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER = ["식비", "카페", "교통", "쇼핑", "생활", "의료", "기타"];
const HIDDEN_CATEGORIES = new Set(["구독"]);
function categoryRank(name: string): number {
  const index = CATEGORY_ORDER.indexOf(name);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const startISO = monthStart(now).toISOString();
  const endISO = monthEnd(now).toISOString();

  const [settingsResult, monthSumResult, recentResult, categoriesResult] =
    await Promise.all([
      supabase
        .from("user_settings")
        .select("monthly_income, fixed_expense")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", user.id)
        .gte("spent_at", startISO)
        .lt("spent_at", endISO),
      supabase
        .from("transactions")
        .select(
          "id, amount, category_id, spent_at, categories ( name, icon )",
        )
        .eq("user_id", user.id)
        .order("spent_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("categories")
        .select("id, name, icon, user_id")
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order("created_at", { ascending: true }),
    ]);

  const settings = settingsResult.data;
  const hasSettings = settings !== null && settings !== undefined;
  const monthlyIncome = Number(settings?.monthly_income ?? 0);
  const fixedExpense = Number(settings?.fixed_expense ?? 0);

  const monthlyExpense = (monthSumResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0,
  );

  type RecentRow = {
    id: string;
    amount: number;
    category_id: string | null;
    spent_at: string;
    categories: { name: string | null; icon: string | null } | null;
  };

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

  const categories: TransactionFormCategory[] = (categoriesResult.data ?? [])
    .filter((row) => !HIDDEN_CATEGORIES.has(row.name))
    .sort((a, b) => categoryRank(a.name) - categoryRank(b.name))
    .map((row) => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
    }));

  return (
    <AppShell>
      <PageHeader
        eyebrow="이번 달 소비를 가볍게 확인해요"
        title="티끌"
        trailing={
          <Link
            href="/settings"
            aria-label="설정"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-full text-muted-foreground",
            )}
          >
            <Settings className="size-5" />
          </Link>
        }
      />

      <SpendingSummary
        monthlyIncome={monthlyIncome}
        fixedExpense={fixedExpense}
        monthlyExpense={monthlyExpense}
        hasSettings={hasSettings}
      />

      <RecentTransactions transactions={recent} categories={categories} />

      <AddTransactionButton categories={categories} />
    </AppShell>
  );
}
