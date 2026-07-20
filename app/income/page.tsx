import Link from "next/link";
import { Settings } from "lucide-react";
import { redirect } from "next/navigation";

import { MonthSwitcher } from "@/app/dashboard/_components/month-switcher";
import { IncomeView } from "@/components/income/income-view";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { buttonVariants } from "@/components/ui/button";
import { getHolidays, holidayRangeForAnchor } from "@/lib/queries/holidays";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { parseYearMonth } from "@/lib/utils/calendar";
import { nowInSeoul, toISODate } from "@/lib/utils/date";
import {
  resolveDashboardParamsB,
  type PayrollRule,
} from "@/lib/utils/payday-cycle";

type IncomeSearchParams = Promise<{ ym?: string }>;

export default async function IncomePage({
  searchParams,
}: {
  searchParams: IncomeSearchParams;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  // getClaims (local JWKS verify) — same auth pattern as the dashboard; RLS
  // still fences every query below.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  // Holidays for the viewed anchor year ±1 (cycles cross year boundaries).
  const anchorYear =
    parseYearMonth(sp.ym ?? "")?.getFullYear() ?? new Date().getFullYear();
  const { yearStart, yearEnd } = holidayRangeForAnchor(anchorYear);
  const [settingsRes, holidays] = await Promise.all([
    supabase
      .from("user_settings")
      .select("payday, payroll_rule, monthly_income")
      .eq("user_id", userId)
      .maybeSingle(),
    getHolidays(yearStart, yearEnd, supabase),
  ]);

  const payday = Number(settingsRes.data?.payday ?? 1);
  const rule = (settingsRes.data?.payroll_rule ?? "prev") as PayrollRule;
  const monthlyIncome = Number(settingsRes.data?.monthly_income ?? 0);

  const now = nowInSeoul();
  const { ym, cycleStart, cycleEnd, cycleLabel } = resolveDashboardParamsB(
    { ym: sp.ym },
    payday,
    rule,
    holidays,
    now,
  );
  const cycleStartDate = toISODate(cycleStart);
  const cycleEndDate = toISODate(cycleEnd);

  // Adjustments in the viewed cycle. Compared as YYYY-MM-DD against the
  // `date`-typed occurred_on column — no timezone round-trips.
  const adjustmentsRes = await supabase
    .from("income_adjustments")
    .select("id, amount, occurred_on, memo")
    .eq("user_id", userId)
    .gte("occurred_on", cycleStartDate)
    .lt("occurred_on", cycleEndDate)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  const items = (adjustmentsRes.data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount ?? 0),
    occurredOn: row.occurred_on,
    memo: row.memo,
  }));

  const isCurrentCycle =
    now.getTime() >= cycleStart.getTime() && now.getTime() < cycleEnd.getTime();
  // Add-form default date: today on the live cycle; the cycle's last day
  // (exclusive end − 1) on past cycles so the picker opens inside range.
  const lastDay = new Date(cycleEnd.getTime() - 86_400_000);
  const addDefaultDate = isCurrentCycle ? toISODate(now) : toISODate(lastDay);

  return (
    <AppShell withBottomNav>
      <PageHeader
        eyebrow="이번 주기 들어온 돈"
        title="수입"
        trailing={
          <Link
            href="/settings"
            prefetch
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

      <div className="mt-2">
        <MonthSwitcher ym={ym} cycleLabel={cycleLabel} basePath="/income" />
      </div>

      <IncomeView
        monthlyIncome={monthlyIncome}
        items={items}
        cycleStartDate={cycleStartDate}
        cycleEndDate={cycleEndDate}
        isCurrentCycle={isCurrentCycle}
        addDefaultDate={addDefaultDate}
      />
    </AppShell>
  );
}
