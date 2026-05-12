import { redirect } from "next/navigation";

import { SpendingSummary } from "@/components/dashboard/spending-summary";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import { createClient } from "@/lib/supabase/server";
import { formatYearMonthKorean } from "@/lib/utils/calendar";

type SpendingSummarySectionProps = {
  ym: string;
};

export async function SpendingSummarySection({
  ym,
}: SpendingSummarySectionProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  const [settingsResult, fixedResult, monthlyResult] = await Promise.all([
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
    getMonthlyTransactions(userId, ym),
  ]);

  const dataError =
    settingsResult.error ??
    fixedResult.error ??
    (!monthlyResult.ok ? new Error(monthlyResult.error) : null);

  if (dataError) {
    return (
      <div className="space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">{`${ym} 요약을 불러오지 못했어요`}</p>
        <p className="break-all text-xs opacity-80">{dataError.message}</p>
      </div>
    );
  }

  const settings = settingsResult.data;
  const hasSettings = settings !== null && settings !== undefined;
  const monthlyIncome = Number(settings?.monthly_income ?? 0);
  const fixedExpense = (fixedResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0,
  );
  const monthlyExpense = monthlyResult.ok ? monthlyResult.monthlyTotal : 0;

  return (
    <SpendingSummary
      monthlyIncome={monthlyIncome}
      fixedExpense={fixedExpense}
      monthlyExpense={monthlyExpense}
      hasSettings={hasSettings}
      monthLabel={formatYearMonthKorean(ym)}
    />
  );
}
