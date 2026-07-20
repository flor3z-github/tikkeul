import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { NotificationToggle } from "@/components/settings/notification-toggle";
import { SettingsForm } from "@/components/settings/settings-form";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { getHolidays, holidayRangeForAnchor } from "@/lib/queries/holidays";
import { type PayrollRule } from "@/lib/utils/payday-cycle";
import { AppVersionFooter } from "@/components/settings/app-version-footer";

const SECTION_HEADING = "px-1 text-[15px] font-semibold tracking-[-0.01em]";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  // Cycles cross year boundaries, so load ±1 year of holidays around now.
  const { yearStart, yearEnd } = holidayRangeForAnchor(new Date().getFullYear());

  const [settingsResult, profileResult, holidays] = await Promise.all([
    supabase
      .from("user_settings")
      .select(
        "payday, payroll_rule, friend_spending_notifications, transaction_interaction_notifications",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle(),
    getHolidays(yearStart, yearEnd, supabase),
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
        initialNickname={profileResult.data?.display_name ?? ""}
        initialPayday={Number(settingsResult.data?.payday ?? 1)}
        initialPayrollRule={
          (settingsResult.data?.payroll_rule ?? "prev") as PayrollRule
        }
        holidays={Array.from(holidays)}
      />

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

      {/* 계정 — 헤더 없이 로그아웃 버튼만 */}
      <section className="mt-10 border-t border-border pt-6">
        <form action={signOutAction}>
          <Button
            type="submit"
            variant="ghost"
            className="h-12 w-full rounded-full bg-destructive/10 text-[14px] font-semibold text-destructive hover:bg-destructive/15 active:bg-destructive/20"
          >
            로그아웃
          </Button>
        </form>
      </section>

      <AppVersionFooter />
    </AppShell>
  );
}
