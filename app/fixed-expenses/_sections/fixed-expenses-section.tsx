import { redirect } from "next/navigation";

import { FixedExpensesView } from "@/components/fixed-expenses/fixed-expenses-view";
import type {
  FixedExpenseRow,
  SubscriptionPlan,
} from "@/components/fixed-expenses/types";
import { createClient } from "@/lib/supabase/server";

export async function FixedExpensesSection() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  const [itemsResult, plansResult] = await Promise.all([
    supabase
      .from("fixed_expenses")
      .select(
        "id, subscription_plan_id, name, plan_name, amount, category, is_active",
      )
      .eq("user_id", userId)
      .order("amount", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("subscription_plans")
      .select(
        "id, service_name, plan_name, default_amount, category, sort_order, aliases",
      )
      .order("sort_order", { ascending: true })
      .order("service_name", { ascending: true }),
  ]);

  if (itemsResult.error) {
    return (
      <div className="space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">고정지출을 불러오지 못했어요</p>
        <p className="break-all text-xs opacity-80">
          {itemsResult.error.message}
        </p>
      </div>
    );
  }
  if (plansResult.error) {
    return (
      <div className="space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">카탈로그를 불러오지 못했어요</p>
        <p className="break-all text-xs opacity-80">
          {plansResult.error.message}
        </p>
      </div>
    );
  }

  const items: FixedExpenseRow[] = (itemsResult.data ?? []).map((row) => ({
    id: row.id,
    subscription_plan_id: row.subscription_plan_id,
    name: row.name,
    plan_name: row.plan_name,
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
    aliases: row.aliases ?? [],
  }));

  return <FixedExpensesView items={items} plans={plans} />;
}
