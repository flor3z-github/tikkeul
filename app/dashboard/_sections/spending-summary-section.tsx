import { redirect } from "next/navigation";

import { SpendingSummary } from "@/components/dashboard/spending-summary";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import { createClient } from "@/lib/supabase/server";

type SpendingSummarySectionProps = {
  startIso: string;
  endIso: string;
  cycleLabel: string;
  targetUserId?: string;
  /**
   * Friend-mode visibility flags. Ignored in own mode (where the data owner
   * always has full visibility of their own data).
   */
  showSpendingTotal?: boolean;
  showSpendingItems?: boolean;
};

export async function SpendingSummarySection({
  startIso,
  endIso,
  cycleLabel,
  targetUserId,
  showSpendingTotal = true,
  showSpendingItems = true,
}: SpendingSummarySectionProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId = claimsData?.claims?.sub ?? null;
  if (!viewerId) redirect("/login");
  const userId = targetUserId ?? viewerId;
  const isOwn = userId === viewerId;

  // Friend mode: this section ONLY renders the total spending card. The
  // calendar + day list block is rendered separately by SpendingCalendarSection
  // and is gated independently by `show_spending_items`. So:
  //   - If `show_spending_total` is OFF, render nothing here — even if items
  //     are ON, the total card still must not appear.
  //   - If items are ON, we already have row-level SELECT (RLS) and can sum
  //     transactions client-side without a separate RPC.
  //   - If only total is granted (items OFF), the SECURITY DEFINER RPC is
  //     the only path because RLS blocks row-level SELECT.
  if (!isOwn) {
    if (!showSpendingTotal) return null;

    if (showSpendingItems) {
      const monthlyResult = await getMonthlyTransactions(
        userId,
        startIso,
        endIso,
      );
      if (!monthlyResult.ok) {
        return (
          <div className="space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
            <p className="font-semibold">{`${cycleLabel} 요약을 불러오지 못했어요`}</p>
            <p className="break-all text-xs opacity-80">{monthlyResult.error}</p>
          </div>
        );
      }
      return (
        <SpendingSummary
          monthlyIncome={0}
          fixedExpense={0}
          monthlyExpense={monthlyResult.monthlyTotal}
          hasSettings={false}
          friendView
          cycleLabel={cycleLabel}
        />
      );
    }

    // Total-only path (items OFF, total ON).
    const { data: totalData, error: totalError } = await supabase.rpc(
      "get_friend_spending_total",
      { target: userId, start_iso: startIso, end_iso: endIso },
    );
    if (totalError) {
      return (
        <div className="space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <p className="font-semibold">{`${cycleLabel} 요약을 불러오지 못했어요`}</p>
          <p className="break-all text-xs opacity-80">{totalError.message}</p>
        </div>
      );
    }
    return (
      <SpendingSummary
        monthlyIncome={0}
        fixedExpense={0}
        monthlyExpense={Number(totalData ?? 0)}
        hasSettings={false}
        friendView
        cycleLabel={cycleLabel}
      />
    );
  }

  // Own mode: existing path — fetch income + fixed + transactions.
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
      friendView={false}
      cycleLabel={cycleLabel}
    />
  );
}
