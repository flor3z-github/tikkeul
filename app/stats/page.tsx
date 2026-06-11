import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { CycleBreakdownView } from "@/components/stats/cycle-breakdown-view";
import { getHolidays, holidayRangeForAnchor } from "@/lib/queries/holidays";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import { createClient } from "@/lib/supabase/server";
import { nowInSeoul } from "@/lib/utils/date";
import {
  getPreviousCycleB,
  resolveDashboardParamsB,
  type PayrollRule,
} from "@/lib/utils/payday-cycle";
import {
  aggregateVariableByCategory,
  fixedTotal,
  mapFixedItems,
  variableTotal,
  type FixedEffectiveItem,
} from "@/lib/utils/stats/cycle-breakdown";
import { clampToElapsedWindow } from "@/lib/utils/stats/elapsed-window";

type FixedRpcRow = {
  id: string;
  name: string;
  plan_name: string | null;
  amount: number | null;
  base_amount: number | null;
  category: string | null;
  payment_day: number | null;
  is_overridden: boolean;
};

/** Same effective-fixed mapping the dashboard uses (override ?? base), so the
 *  fixed total here equals the dashboard's `ownFixedExpense`. */
function mapFixedRpcRows(data: unknown): FixedEffectiveItem[] {
  return ((data ?? []) as FixedRpcRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    plan_name: row.plan_name,
    amount: row.amount == null ? null : Number(row.amount),
    base_amount: row.base_amount == null ? null : Number(row.base_amount),
    category: row.category,
    payment_day: row.payment_day,
    is_overridden: row.is_overridden,
  }));
}

// No `export const dynamic = "force-dynamic"` — the dashboard (our closest
// reference) intentionally omits it under the global `cacheComponents: true`
// (Next 16 PPR). getClaims() + uncached Supabase reads already force the
// dynamic path; a per-route opt-in would be redundant at best.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StatsSearchParams = Promise<{ viewing?: string }>;

export default async function StatsPage({
  searchParams,
}: {
  searchParams: StatsSearchParams;
}) {
  const sp = await searchParams;

  // Stats is OWN-ONLY (§12.9). The entry point is hidden in friend mode, but
  // defend the route directly: if a `viewing` param leaks in, bounce back to
  // the friend dashboard — we never compute a friend's spending composition.
  if (sp.viewing && UUID_RE.test(sp.viewing)) {
    redirect(`/dashboard?viewing=${sp.viewing}`);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId = claimsData?.claims?.sub ?? null;
  if (!viewerId) redirect("/login");

  // Cycle resolution: same payday engine as the dashboard. v1 shows the current
  // cycle only (no switcher) — the entry point is gated to the current cycle on
  // the dashboard side, so the top total always matches what the card showed.
  const { yearStart, yearEnd } = holidayRangeForAnchor(new Date().getFullYear());
  const [settingsRes, holidays] = await Promise.all([
    supabase
      .from("user_settings")
      .select("payday, payroll_rule")
      .eq("user_id", viewerId)
      .maybeSingle(),
    getHolidays(yearStart, yearEnd, supabase),
  ]);

  let payday = 1;
  let rule: PayrollRule = "prev";
  if (settingsRes.data) {
    payday = Number(settingsRes.data.payday ?? 1);
    rule = (settingsRes.data.payroll_rule ?? "prev") as PayrollRule;
  }

  const now = nowInSeoul();
  const { ym, cycleStart, cycleEnd, cycleLabel } = resolveDashboardParamsB(
    {},
    payday,
    rule,
    holidays,
    now,
  );
  const startIso = cycleStart.toISOString();
  const endIso = cycleEnd.toISOString();

  // Previous cycle (for 전월比 deltas) — resolved by the same payday engine, not
  // naive month math (cycles cross year boundaries). prevCycle.end === cycleStart.
  const prevCycle = getPreviousCycleB(payday, rule, holidays, cycleStart);
  const prevStartIso = prevCycle.start.toISOString();
  const prevEndIso = prevCycle.end.toISOString();

  const [monthlyResult, fixedRes, prevMonthly, prevFixedRes] =
    await Promise.all([
      getMonthlyTransactions(viewerId, startIso, endIso),
      supabase.rpc("get_fixed_effective_items", {
        target: viewerId,
        cycle_anchor: ym,
      }),
      getMonthlyTransactions(viewerId, prevStartIso, prevEndIso),
      supabase.rpc("get_fixed_effective_items", {
        target: viewerId,
        cycle_anchor: prevCycle.anchorYm,
      }),
    ]);

  const backToDashboard = (
    <PageHeader
      eyebrow={
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
          대시보드
        </Link>
      }
      title="통계"
    />
  );

  if (!monthlyResult.ok) {
    return (
      <AppShell>
        {backToDashboard}
        <div className="mt-4 space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <p className="font-semibold">소비 구성을 불러오지 못했어요</p>
          <p className="break-all text-xs opacity-80">{monthlyResult.error}</p>
        </div>
      </AppShell>
    );
  }

  const fixedItems = mapFixedRpcRows(fixedRes.data);
  const transactions = monthlyResult.transactions;
  const varTotal = variableTotal(transactions);
  const fixTotal = fixedTotal(fixedItems);

  // 전월比 gate: only compare when the previous cycle had REAL transactions.
  // Fixed expenses are standing records (get_fixed_effective_items returns them
  // for any anchor), so prevFixed > 0 alone would make a first-ever cycle show a
  // fake "지난 사이클보다 +전부". Requiring prev transactions kills that trap; the
  // per-row deltas then naturally hide unchanged/new items.
  const hasPrevBaseline =
    prevMonthly.ok && prevMonthly.transactions.length > 0;
  // 변동 전월比는 같은 경과 시점끼리 비교한다(§12.9): 진행 중인 이번 사이클은
  // "지금까지" 쓴 부분합인데 직전은 완료된 전체합이라, 직전 변동을 이번 사이클이
  // 지난 경과 시간만큼만 잘라 비교한다(고정은 결제일 step이라 자르지 않음 — 아래
  // prevFixedItems는 전액 유지). 이번 사이클 측은 자르지 않는다: 상단 총액이
  // 대시보드 monthlyTotal과 정확히 같아야 하는 불변식(§12.9) 보존 + 미래일자 거래
  // 엣지 때문.
  const prevTransactions = hasPrevBaseline
    ? clampToElapsedWindow(
        prevMonthly.transactions,
        cycleStart,
        prevCycle.start,
        now,
      )
    : undefined;
  // 고정 per-row delta는 직전 fixed RPC가 성공했을 때만 켠다 — 실패 시 prev가
  // 0으로 읽혀 delta가 부풀려지는 것 차단. 변동 delta는 prevMonthly에만 의존.
  const prevFixedOk = !prevFixedRes.error;
  const prevFixedItems =
    hasPrevBaseline && prevFixedOk
      ? mapFixedRpcRows(prevFixedRes.data)
      : undefined;

  return (
    <AppShell>
      {backToDashboard}
      <CycleBreakdownView
        cycleLabel={cycleLabel}
        grandTotal={varTotal + fixTotal}
        variableTotal={varTotal}
        fixedTotal={fixTotal}
        variableRows={aggregateVariableByCategory(transactions, prevTransactions)}
        fixedRows={mapFixedItems(fixedItems, prevFixedItems)}
      />
    </AppShell>
  );
}
