import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { CycleBreakdownView } from "@/components/stats/cycle-breakdown-view";
import { getHolidays, holidayRangeForAnchor } from "@/lib/queries/holidays";
import { getMonthlyTransactions } from "@/lib/queries/transactions";
import { createClient } from "@/lib/supabase/server";
import { parseYearMonth } from "@/lib/utils/calendar";
import { nowInSeoul } from "@/lib/utils/date";
import {
  getPreviousCycleB,
  resolveDashboardParamsB,
  type PayrollRule,
} from "@/lib/utils/payday-cycle";
import { thisMonthSaved, type SavingsPlanRow } from "@/lib/utils/savings";
import {
  aggregateVariableByCategory,
  fixedTotal,
  mapFixedItems,
  variableTotal,
  type FixedEffectiveItem,
} from "@/lib/utils/stats/cycle-breakdown";
import { clampToElapsedWindow } from "@/lib/utils/stats/elapsed-window";
import { aggregatePaymentSplit } from "@/lib/utils/stats/payment-split";

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

type StatsSearchParams = Promise<{ viewing?: string; ym?: string }>;

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

  // Cycle resolution: same payday engine as the dashboard. `?ym` is the LABEL
  // month threaded from the dashboard CTA (it carries the currently-viewed
  // cycle's ym), so /stats renders the SAME cycle the card showed and the top
  // total always matches. Absent/invalid ym → resolveDashboardParamsB falls back
  // to the cycle containing `now`. There's no in-page switcher: month navigation
  // lives on the dashboard, and the entry CTA passes its ym here.
  // Holidays for the VIEWED anchor year ±1, not the current year — a past/future
  // cycle in another year needs that year's holidays for correct business-day
  // adjustment (mirrors the dashboard's anchorYear). Absent/invalid ym → current.
  const anchorYear =
    parseYearMonth(sp.ym ?? "")?.getFullYear() ?? new Date().getFullYear();
  const { yearStart, yearEnd } = holidayRangeForAnchor(anchorYear);
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
    { ym: sp.ym },
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

  // 보고 있는 주기가 지금 살고 있는 주기인지 — 전월比 클램프(아래)와 저축 노출을 모두
  // 게이트한다. 완료된 과거 주기는 전월比를 전체 vs 전체로 비교하고, 저축(이번 달 흐름)도
  // 띄우지 않는다(과거 주기의 저축 문구는 의미가 없음).
  const isLiveCycle =
    now.getTime() >= cycleStart.getTime() &&
    now.getTime() < cycleEnd.getTime();

  const [monthlyResult, fixedRes, prevMonthly, prevFixedRes, savingsRes] =
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
      // 저축은 대시보드와 동일하게 현재 사이클에서만 노출(§12.6) — /stats 총 소비(고정+변동)
      // 와 대시보드 「나간 돈」(+저축)의 괴리를 히어로에 설명하기 위한 값.
      isLiveCycle
        ? supabase
            .from("savings_plans")
            .select(
              "id, name, amount, payment_day, start_date, opening_balance, goal_amount, maturity_date, is_active",
            )
            .eq("user_id", viewerId)
            .eq("is_active", true)
        : Promise.resolve(null),
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
  // 변동 전월比 컷오프는 보고 있는 주기가 진행 중일 때만 적용한다(§12.9): 진행 중인
  // 주기는 "지금까지" 쓴 부분합인데 직전은 완료된 전체합이라, 직전 변동을 이번 주기가
  // 지난 경과 시간만큼만 잘라 같은 시점끼리 비교한다(고정은 결제일 step이라 자르지
  // 않음 — 아래 prevFixedItems는 전액 유지). 진행 중 주기 측은 자르지 않는다: 상단
  // 총액이 대시보드 monthlyTotal과 정확히 같아야 하는 불변식(§12.9) 보존 + 미래일자
  // 거래 엣지 때문.
  //   완료된 과거 주기(isLiveCycle=false)는 컷오프를 끈다: elapsed-window 클램프의
  // 전제("이번 측은 부분합")가 사라져 양쪽 다 완료된 전체합이므로 전체 vs 전체가
  // 맞다. clampToElapsedWindow는 elapsed 기반이라, 직전 주기가 이번보다 길면(예:
  // Jan 31일 vs Feb 28일) 방금 닫힌 주기를 이른 시점에 볼 때 직전 꼬리 며칠이 잘려
  // 델타가 "증가" 쪽으로 편향된다 — 과거 주기에선 자르지 않아야 이를 막는다.
  const prevTransactions = hasPrevBaseline
    ? isLiveCycle
      ? clampToElapsedWindow(
          prevMonthly.transactions,
          cycleStart,
          prevCycle.start,
          now,
        )
      : prevMonthly.transactions
    : undefined;
  // 고정 per-row delta는 직전 fixed RPC가 성공했을 때만 켠다 — 실패 시 prev가
  // 0으로 읽혀 delta가 부풀려지는 것 차단. 변동 delta는 prevMonthly에만 의존.
  const prevFixedOk = !prevFixedRes.error;
  const prevFixedItems =
    hasPrevBaseline && prevFixedOk
      ? mapFixedRpcRows(prevFixedRes.data)
      : undefined;

  // 이번 달 모으기액(저축+투자) — 대시보드 「나간 돈」이 접는 값과 같은 산식
  // (thisMonthSaved). 현재 사이클이 아니면 savingsRes=null이라 0 → 히어로 문구가 안 뜬다.
  const savingsExcluded =
    savingsRes?.data != null
      ? thisMonthSaved(savingsRes.data as SavingsPlanRow[], now)
      : 0;

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
        paymentSplit={aggregatePaymentSplit(transactions)}
        savingsExcluded={savingsExcluded}
      />
    </AppShell>
  );
}
