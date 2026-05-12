import { redirect } from "next/navigation";

import { SpendingSummary } from "@/components/dashboard/spending-summary";
import { createClient } from "@/lib/supabase/server";
import { monthEnd, monthStart } from "@/lib/utils/date";

export async function SpendingSummarySection() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  const now = new Date();
  const startISO = monthStart(now).toISOString();
  const endISO = monthEnd(now).toISOString();

  const [settingsResult, fixedResult, monthSumResult] = await Promise.all([
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
    supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .gte("spent_at", startISO)
      .lt("spent_at", endISO),
  ]);

  const dataError =
    settingsResult.error ?? fixedResult.error ?? monthSumResult.error ?? null;

  if (dataError) {
    return (
      <div className="space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">이번 달 요약을 불러오지 못했어요</p>
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
  const monthlyExpense = (monthSumResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0,
  );

  return (
    <SpendingSummary
      monthlyIncome={monthlyIncome}
      fixedExpense={fixedExpense}
      monthlyExpense={monthlyExpense}
      hasSettings={hasSettings}
    />
  );
}
