import { redirect } from "next/navigation";

import { CalendarDayPanel } from "@/components/dashboard/calendar-day-panel";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/queries/categories";
import { getMonthlyTransactions } from "@/lib/queries/transactions";

type SpendingCalendarSectionProps = {
  ym: string;
  initialDay: string;
};

export async function SpendingCalendarSection({
  ym,
  initialDay,
}: SpendingCalendarSectionProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  const [monthlyResult, categoriesResult, settingsResult, fixedResult] =
    await Promise.all([
      getMonthlyTransactions(userId, ym),
      getCategories(userId),
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

  if (!categoriesResult.ok) {
    return (
      <div className="mt-3 space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">카테고리를 불러오지 못했어요</p>
        <p className="break-all text-xs opacity-80">{categoriesResult.error}</p>
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
    <CalendarDayPanel
      key={ym}
      ym={ym}
      initialDay={initialDay}
      transactions={monthlyResult.transactions}
      categories={categoriesResult.categories}
      availableBudget={availableBudget}
    />
  );
}
