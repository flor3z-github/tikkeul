import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { FixedExpensesView } from "@/components/fixed-expenses/fixed-expenses-view";
import type {
  FixedExpenseRow,
  SubscriptionPlan,
} from "@/components/fixed-expenses/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const settingsTrailing = (
  <Link
    href="/settings"
    aria-label="설정"
    className={cn(
      buttonVariants({ variant: "ghost", size: "icon" }),
      "rounded-full text-muted-foreground",
    )}
  >
    <Settings className="size-5" />
  </Link>
);

export default async function FixedExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [itemsResult, plansResult] = await Promise.all([
    supabase
      .from("fixed_expenses")
      .select(
        "id, subscription_plan_id, name, amount, category, is_active",
      )
      .eq("user_id", user.id)
      .order("amount", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("subscription_plans")
      .select(
        "id, service_name, plan_name, default_amount, category, sort_order",
      )
      .order("sort_order", { ascending: true })
      .order("service_name", { ascending: true }),
  ]);

  // Surface query failures instead of silently treating them as empty. A
  // missing migration or RLS misconfiguration would otherwise hide the bug.
  if (itemsResult.error) {
    return <ErrorScreen message={itemsResult.error.message} kind="items" />;
  }
  if (plansResult.error) {
    return <ErrorScreen message={plansResult.error.message} kind="plans" />;
  }

  const items: FixedExpenseRow[] = (itemsResult.data ?? []).map((row) => ({
    id: row.id,
    subscription_plan_id: row.subscription_plan_id,
    name: row.name,
    amount: Number(row.amount),
    category: row.category,
    is_active: row.is_active,
  }));

  const plans: SubscriptionPlan[] = (plansResult.data ?? []).map((row) => ({
    id: row.id,
    service_name: row.service_name,
    plan_name: row.plan_name,
    default_amount: Number(row.default_amount),
    category: row.category,
    sort_order: row.sort_order,
  }));

  return (
    <AppShell withBottomNav>
      <PageHeader
        eyebrow="매달 빠지는 돈"
        title="고정지출"
        trailing={settingsTrailing}
      />
      <FixedExpensesView items={items} plans={plans} />
    </AppShell>
  );
}

function ErrorScreen({
  message,
  kind,
}: {
  message: string;
  kind: "items" | "plans";
}) {
  const title =
    kind === "items" ? "고정지출을 불러오지 못했어요" : "카탈로그를 불러오지 못했어요";
  return (
    <AppShell withBottomNav>
      <PageHeader
        eyebrow="매달 빠지는 돈"
        title="고정지출"
        trailing={settingsTrailing}
      />
      <div className="mt-4 space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">{title}</p>
        <p className="break-all text-xs opacity-80">{message}</p>
        <p className="text-xs opacity-80">
          마이그레이션이 적용되지 않았거나 권한 설정에 문제가 있을 수 있어요.
        </p>
      </div>
    </AppShell>
  );
}
