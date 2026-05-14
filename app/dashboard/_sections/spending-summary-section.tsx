import { redirect } from "next/navigation";

import { SpendingSummary } from "@/components/dashboard/spending-summary";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import { createClient } from "@/lib/supabase/server";

type SpendingSummarySectionProps = {
  startIso: string;
  endIso: string;
  cycleLabel: string;
  targetUserId?: string;
};

export async function SpendingSummarySection({
  startIso,
  endIso,
  cycleLabel,
  targetUserId,
}: SpendingSummarySectionProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId = claimsData?.claims?.sub ?? null;
  if (!viewerId) redirect("/login");
  const userId = targetUserId ?? viewerId;
  const isOwn = userId === viewerId;

  // Friend view: do not expose income/fixed-expense. Only show this-cycle
  // expense total. user_settings/fixed_expenses RLS would block these queries
  // anyway, but skipping the round-trip keeps the section deterministic.
  const [settingsResult, fixedResult, monthlyResult] = await Promise.all([
    isOwn
      ? supabase
          .from("user_settings")
          .select("monthly_income")
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null as null | { message: string } }),
    isOwn
      ? supabase
          .from("fixed_expenses")
          .select("amount")
          .eq("user_id", userId)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null as null | { message: string } }),
    getMonthlyTransactions(userId, startIso, endIso),
  ]);

  const dataError =
    settingsResult.error ??
    fixedResult.error ??
    (!monthlyResult.ok ? new Error(monthlyResult.error) : null);

  if (dataError) {
    return (
      <div className="space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">{`${cycleLabel} 요약을 불러오지 못했어요`}</p>
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
      friendView={!isOwn}
    />
  );
}
