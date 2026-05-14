import { redirect } from "next/navigation";

import { CalendarDayPanel } from "@/components/dashboard/calendar-day-panel";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/queries/categories";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import type { CycleMode } from "@/lib/utils/calendar";

type SpendingCalendarSectionProps = {
  ym: string;
  initialDay: string;
  startIso: string;
  endIso: string;
  cycleStart: Date;
  cycleEnd: Date;
  cycleMode: CycleMode;
  cycleLabel: string;
  targetUserId?: string;
};

export async function SpendingCalendarSection({
  ym,
  initialDay,
  startIso,
  endIso,
  cycleStart,
  cycleEnd,
  cycleMode,
  cycleLabel,
  targetUserId,
}: SpendingCalendarSectionProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId = claimsData?.claims?.sub ?? null;
  if (!viewerId) redirect("/login");
  const userId = targetUserId ?? viewerId;
  const isOwn = userId === viewerId;

  // Categories are shared seeds + the viewer's own customs; pass viewerId so
  // we still surface the viewer's category list (which is what they can pick
  // when adding their own transactions). For friend-view mode this is unused
  // because the calendar is read-only, but the prop is still required.
  const [monthlyResult, categoriesResult, settingsResult, fixedResult] =
    await Promise.all([
      getMonthlyTransactions(userId, startIso, endIso),
      getCategories(viewerId),
      isOwn
        ? supabase
            .from("user_settings")
            .select("monthly_income")
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null as null | { message: string },
          }),
      isOwn
        ? supabase
            .from("fixed_expenses")
            .select("amount")
            .eq("user_id", userId)
            .eq("is_active", true)
        : Promise.resolve({
            data: [],
            error: null as null | { message: string },
          }),
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
      key={`${ym}-${cycleMode}`}
      ym={ym}
      initialDay={initialDay}
      cycleStart={cycleStart}
      cycleEnd={cycleEnd}
      cycleMode={cycleMode}
      cycleLabel={cycleLabel}
      transactions={monthlyResult.transactions}
      categories={categoriesResult.categories}
      availableBudget={availableBudget}
      readOnly={!isOwn}
    />
  );
}
