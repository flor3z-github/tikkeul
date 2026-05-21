import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { NotificationToggle } from "@/components/settings/notification-toggle";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingsExtras } from "@/components/settings/extras-section";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { getCycleRange } from "@/lib/utils/calendar";
import { toISODate } from "@/lib/utils/date";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  const [settingsResult, profileResult] = await Promise.all([
    supabase
      .from("user_settings")
      .select(
        "monthly_income, cycle_mode, cycle_start_day, friend_spending_notifications, transaction_interaction_notifications",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle(),
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
        initialIncome={Number(settingsResult.data?.monthly_income ?? 0)}
        initialNickname={profileResult.data?.display_name ?? ""}
        initialCycleMode={settingsResult.data?.cycle_mode ?? "calendar"}
        initialCycleStartDay={Number(settingsResult.data?.cycle_start_day ?? 1)}
      />

      {(() => {
        // Resolve the viewer's *current* cycle so the income drawer in the
        // extras section can bound its calendar picker. The dashboard does
        // this same calc for the rendered cycle — here we always anchor on
        // today since settings has no month-switcher of its own.
        const cycleMode = settingsResult.data?.cycle_mode ?? "calendar";
        const cycleStartDay = Number(
          settingsResult.data?.cycle_start_day ?? 1,
        );
        const range = getCycleRange(cycleMode, cycleStartDay, new Date());
        const now = new Date();
        const todayMid = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        const inRange =
          todayMid.getTime() >= range.start.getTime() &&
          todayMid.getTime() < range.end.getTime();
        const defaultDate = toISODate(inRange ? todayMid : range.start);
        return (
          <div className="mt-10 border-t border-border pt-6">
            <SettingsExtras
              cycleStart={toISODate(range.start)}
              cycleEnd={toISODate(range.end)}
              defaultDate={defaultDate}
            />
          </div>
        );
      })()}

      <div className="mt-10 space-y-8 border-t border-border pt-6">
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

      <div className="mt-10 border-t border-border pt-6">
        <form action={signOutAction}>
          <Button
            type="submit"
            variant="ghost"
            className="h-12 w-full rounded-full text-destructive"
          >
            로그아웃
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
