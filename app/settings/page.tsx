import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { SettingsForm } from "@/components/settings/settings-form";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("monthly_income, fixed_expense")
    .eq("user_id", user.id)
    .maybeSingle();

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
        initialIncome={Number(settings?.monthly_income ?? 0)}
        initialFixed={Number(settings?.fixed_expense ?? 0)}
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
