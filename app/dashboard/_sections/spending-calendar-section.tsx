import { redirect } from "next/navigation";

import { SpendingMonthGrid } from "@/components/calendar/spending-month-grid";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import { MonthSwitcher } from "@/app/dashboard/_components/month-switcher";

type SpendingCalendarSectionProps = {
  ym: string;
  day: string;
};

export async function SpendingCalendarSection({
  ym,
  day,
}: SpendingCalendarSectionProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  const [monthlyResult, settingsResult, fixedResult] = await Promise.all([
    getMonthlyTransactions(userId, ym),
    supabase
      .from("user_settings")
      .select("monthly_income")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("fixed_expenses")
      .select("amount")
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  if (!monthlyResult.ok) {
    return (
      <div className="mt-3 space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">달력을 불러오지 못했어요</p>
        <p className="break-all text-xs opacity-80">{monthlyResult.error}</p>
      </div>
    );
  }

  const monthlyIncome = Number(settingsResult.data?.monthly_income ?? 0);
  const fixedExpense = (fixedResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0,
  );
  const availableBudget = Math.max(0, monthlyIncome - fixedExpense);

  return (
    <div className="mt-3 space-y-1.5 rounded-3xl border border-black/[0.08] bg-card p-3 dark:border-white/[0.10]">
      <MonthSwitcher ym={ym} />
      <SpendingMonthGrid
        ym={ym}
        selectedDay={day}
        dailyTotals={monthlyResult.dailyTotals}
        availableBudget={availableBudget}
      />
    </div>
  );
}
