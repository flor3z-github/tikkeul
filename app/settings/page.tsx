import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { SettingsForm } from "@/components/settings/settings-form";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const settingsResult = await supabase
    .from("user_settings")
    .select("monthly_income")
    .eq("user_id", user.id)
    .maybeSingle();

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
      />

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
