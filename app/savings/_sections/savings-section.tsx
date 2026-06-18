import { redirect } from "next/navigation";

import { SavingsView } from "@/components/savings/savings-view";
import { createClient } from "@/lib/supabase/server";
import { nowInSeoul, toISODate } from "@/lib/utils/date";
import type { SavingsPlanRow } from "@/lib/utils/savings";

export async function SavingsSection() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  if (!userId) redirect("/login");

  const { data, error } = await supabase
    .from("savings_plans")
    .select(
      "id, name, amount, payment_day, start_date, opening_balance, goal_amount, maturity_date, is_active",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div className="space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">돈모으기를 불러오지 못했어요</p>
        <p className="break-all text-xs opacity-80">{error.message}</p>
      </div>
    );
  }

  const plans: SavingsPlanRow[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    amount: row.amount == null ? null : Number(row.amount),
    payment_day: row.payment_day ?? null,
    start_date: row.start_date,
    opening_balance: Number(row.opening_balance ?? 0),
    goal_amount: row.goal_amount == null ? null : Number(row.goal_amount),
    maturity_date: row.maturity_date ?? null,
    is_active: row.is_active,
  }));

  return <SavingsView plans={plans} nowISO={toISODate(nowInSeoul())} />;
}
