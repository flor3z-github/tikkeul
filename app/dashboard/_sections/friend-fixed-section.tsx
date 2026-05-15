import { redirect } from "next/navigation";

import { FriendFixedSummary } from "@/components/dashboard/friend-fixed-summary";
import {
  type FixedExpenseRow,
  type SubscriptionPlan,
} from "@/components/fixed-expenses/types";
import { createClient } from "@/lib/supabase/server";

type FriendFixedSectionProps = {
  target: string;
  showTotal: boolean;
  showItems: boolean;
};

export async function FriendFixedSection({
  target,
  showTotal,
  showItems,
}: FriendFixedSectionProps) {
  if (!showTotal && !showItems) return null;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId = claimsData?.claims?.sub ?? null;
  if (!viewerId) redirect("/login");

  // When items are visible, fetch rows directly — RLS now permits the
  // friend SELECT. We compute the total client-side from the same rows.
  // When only the total is granted, the SECURITY DEFINER RPC is the only
  // path; row-level SELECT is blocked.
  if (showItems) {
    const [itemsResult, plansResult] = await Promise.all([
      supabase
        .from("fixed_expenses")
        .select(
          "id, subscription_plan_id, name, plan_name, amount, category, is_active",
        )
        .eq("user_id", target)
        .eq("is_active", true)
        .order("amount", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("subscription_plans")
        .select(
          "id, service_name, plan_name, default_amount, category, sort_order, aliases",
        ),
    ]);

    if (itemsResult.error) {
      return (
        <div className="mt-6 space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <p className="font-semibold">고정지출을 불러오지 못했어요</p>
          <p className="break-all text-xs opacity-80">
            {itemsResult.error.message}
          </p>
        </div>
      );
    }

    const items = (itemsResult.data ?? []) as FixedExpenseRow[];
    const plans = (plansResult.data ?? []) as SubscriptionPlan[];
    const total = items.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

    return <FriendFixedSummary total={total} items={items} plans={plans} />;
  }

  // Total-only path: viewer can see the sum but not the rows.
  const { data: totalData, error: totalError } = await supabase.rpc(
    "get_friend_fixed_total",
    { target },
  );

  if (totalError) {
    return (
      <div className="mt-6 space-y-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">고정지출 합계를 불러오지 못했어요</p>
        <p className="break-all text-xs opacity-80">{totalError.message}</p>
      </div>
    );
  }

  return <FriendFixedSummary total={Number(totalData ?? 0)} />;
}
