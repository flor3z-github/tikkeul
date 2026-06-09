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
  /** anchorYm "YYYY-MM" of the cycle being viewed — resolves per-cycle overrides. */
  cycleAnchor: string;
};

export async function FriendFixedSection({
  target,
  showTotal,
  showItems,
  cycleAnchor,
}: FriendFixedSectionProps) {
  if (!showTotal && !showItems) return null;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId = claimsData?.claims?.sub ?? null;
  if (!viewerId) redirect("/login");

  // When items are visible, read effective amounts (override ?? base) for this
  // cycle through the perm-gated SECURITY DEFINER RPC. The override table has
  // no friend RLS — the RPC is the only friend path and returns ONLY the
  // effective amount (no base_amount / is_overridden for a friend), so the
  // per-cycle adjustment signal stays private. Total-only path uses the
  // cycle-aware 2-arg get_friend_fixed_total; row-level SELECT stays blocked.
  if (showItems) {
    const [itemsResult, plansResult] = await Promise.all([
      supabase.rpc("get_fixed_effective_items", {
        target,
        cycle_anchor: cycleAnchor,
      }),
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

    const items: FixedExpenseRow[] = (itemsResult.data ?? []).map((row) => ({
      id: row.id,
      subscription_plan_id: row.subscription_plan_id,
      name: row.name,
      plan_name: row.plan_name,
      amount: row.amount == null ? null : Number(row.amount),
      category: row.category,
      is_active: true,
      payment_day: row.payment_day,
    }));
    // RPC is unordered; mirror the old amount-desc list with 미입력 (null) last.
    items.sort((a, b) => {
      if (a.amount == null && b.amount == null) return 0;
      if (a.amount == null) return 1;
      if (b.amount == null) return -1;
      return b.amount - a.amount;
    });
    const plans = (plansResult.data ?? []) as SubscriptionPlan[];
    const total = items.reduce((sum, row) => sum + (row.amount ?? 0), 0);

    return <FriendFixedSummary total={total} items={items} plans={plans} />;
  }

  // Total-only path: viewer can see the sum but not the rows.
  const { data: totalData, error: totalError } = await supabase.rpc(
    "get_friend_fixed_total",
    { target, cycle_anchor: cycleAnchor },
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
