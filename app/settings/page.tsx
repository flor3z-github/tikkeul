import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { NotificationToggle } from "@/components/settings/notification-toggle";
import { SettingsForm } from "@/components/settings/settings-form";
import {
  AddIncomeButton,
  GuideResetButton,
} from "@/components/settings/extras-section";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { getHolidays, holidayRangeForAnchor } from "@/lib/queries/holidays";
import { getCurrentCycleB, type PayrollRule } from "@/lib/utils/payday-cycle";
import { toISODate, nowInSeoul } from "@/lib/utils/date";
import { formatKRW } from "@/lib/utils/money";
import { AppVersionFooter } from "@/components/settings/app-version-footer";

const SECTION_HEADING = "px-1 text-[15px] font-semibold tracking-[-0.01em]";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  // Cycles cross year boundaries, so load ±1 year of holidays around now.
  const { yearStart, yearEnd } = holidayRangeForAnchor(new Date().getFullYear());

  const [settingsResult, profileResult, holidays, fixedResult] =
    await Promise.all([
      supabase
        .from("user_settings")
        .select(
          "monthly_income, payday, payroll_rule, friend_spending_notifications, transaction_interaction_notifications",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle(),
      getHolidays(yearStart, yearEnd, supabase),
      supabase
        .from("fixed_expenses")
        .select("amount")
        .eq("user_id", userId)
        .eq("is_active", true),
    ]);

  if (settingsResult.error) {
    return (
      <AppShell>
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
          title="설정"
        />
        <div className="mt-4 space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <p className="font-semibold">설정을 불러오지 못했어요</p>
          <p className="break-all text-xs opacity-80">
            {settingsResult.error.message}
          </p>
        </div>
      </AppShell>
    );
  }

  // 고정지출 합계는 돈 숫자라, 쿼리 실패 시 "0원"으로 보이면 "고정지출 없음"으로
  // 오인된다 — 에러일 땐 합계 대신 "—"를 띄운다(친구 칩과 달리 graceful-0 부적절).
  const fixedError = Boolean(fixedResult.error);
  const fixedTotal = (fixedResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0,
  );

  // Resolve the viewer's *current* cycle so the income drawer (추가 수입 등록)
  // can bound its calendar picker. Anchor on today since settings has no
  // month-switcher of its own; resolve the cycle CONTAINING today (not today's
  // nominal-month cycle) — on edge days a prev/next/말일 adjustment moves the
  // boundary across a month line.
  const payday = Number(settingsResult.data?.payday ?? 1);
  const rule = (settingsResult.data?.payroll_rule ?? "prev") as PayrollRule;
  const now = nowInSeoul();
  const range = getCurrentCycleB(payday, rule, holidays, now);
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inRange =
    todayMid.getTime() >= range.start.getTime() &&
    todayMid.getTime() < range.end.getTime();
  const defaultDate = toISODate(inRange ? todayMid : range.start);

  return (
    <AppShell>
      <PageHeader
        eyebrow={
          <Link
            href="/dashboard"
            prefetch
            className="inline-flex items-center gap-1 text-muted-foreground"
          >
            <ChevronLeft className="size-4" />
            대시보드
          </Link>
        }
        title="설정"
      />

      <SettingsForm
        initialIncome={Number(settingsResult.data?.monthly_income ?? 0)}
        initialNickname={profileResult.data?.display_name ?? ""}
        initialPayday={Number(settingsResult.data?.payday ?? 1)}
        initialPayrollRule={
          (settingsResult.data?.payroll_rule ?? "prev") as PayrollRule
        }
        holidays={Array.from(holidays)}
      />

      {/* 수입·지출 관리 — 고정지출 진입 + 추가 수입 등록(즉시 액션) */}
      <section className="mt-10 space-y-3 border-t border-border pt-6">
        <h2 className={SECTION_HEADING}>수입·지출 관리</h2>
        <div className="space-y-2">
          <Link
            href="/fixed-expenses"
            prefetch
            className="flex h-12 w-full items-center justify-between gap-3 rounded-2xl bg-card px-4 text-[14px] transition-colors hover:bg-muted/60 active:bg-muted"
          >
            <span className="flex items-center gap-2">
              <Repeat className="size-4 text-muted-foreground" aria-hidden />
              월 고정지출
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {fixedError ? "—" : formatKRW(fixedTotal)}
              </span>
              <ChevronRight className="size-4" aria-hidden />
            </span>
          </Link>
          <AddIncomeButton
            cycleStart={toISODate(range.start)}
            cycleEnd={toISODate(range.end)}
            defaultDate={defaultDate}
          />
        </div>
      </section>

      {/* 알림 */}
      <section className="mt-10 space-y-4 border-t border-border pt-6">
        <h2 className={SECTION_HEADING}>알림</h2>
        <div className="space-y-8">
          <NotificationToggle
            kind="friend_spending"
            initialEnabled={
              settingsResult.data?.friend_spending_notifications ?? false
            }
            vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
          />
          <NotificationToggle
            kind="interaction"
            initialEnabled={
              settingsResult.data?.transaction_interaction_notifications ?? false
            }
            vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
          />
        </div>
      </section>

      {/* 기타 */}
      <section className="mt-10 space-y-3 border-t border-border pt-6">
        <h2 className={SECTION_HEADING}>기타</h2>
        <GuideResetButton />
      </section>

      {/* 계정 */}
      <section className="mt-10 space-y-3 border-t border-border pt-6">
        <h2 className={SECTION_HEADING}>계정</h2>
        <form action={signOutAction}>
          <Button
            type="submit"
            variant="ghost"
            className="h-12 w-full rounded-full text-destructive"
          >
            로그아웃
          </Button>
        </form>
      </section>

      <AppVersionFooter />
    </AppShell>
  );
}
