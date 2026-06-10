import {
  type FixedExpenseRow,
  type SubscriptionPlan,
} from "@/components/fixed-expenses/types";
import { formatKRW } from "@/lib/utils/money";

type FriendFixedSummaryProps = {
  total: number;
  items?: FixedExpenseRow[];
  plans?: SubscriptionPlan[];
  /**
   * Skip the "친구의 고정지출 합계" total header, rendering only the item list.
   * Used when the summary card above already shows the fixed total as part of
   * its 고정/변동 split, so repeating the same sum here would be redundant.
   * Only meaningful in the items path (a header-only card with no items would
   * render nothing).
   */
  hideTotal?: boolean;
};

// Caller wraps this in `<section><h2>고정지출</h2>` (see app/dashboard/page.tsx).
// We render flat content blocks — no Card wrappers — so the visual hierarchy
// stays "heading + body", matching the spending block's typography-first
// layout in friend mode.
export function FriendFixedSummary({
  total,
  items,
  plans,
  hideTotal = false,
}: FriendFixedSummaryProps) {
  const planById = new Map<string, SubscriptionPlan>();
  for (const plan of plans ?? []) planById.set(plan.id, plan);

  return (
    <>
      {hideTotal ? null : (
        <div className="space-y-2 px-1">
          <p className="text-sm font-medium text-muted-foreground">
            친구의 고정지출 합계
          </p>
          <p className="text-[40px] font-bold leading-none tracking-[-0.045em] tabular-nums">
            {formatKRW(total)}
          </p>
          {items ? (
            <p className="text-xs text-muted-foreground">
              총 {items.length}개 항목
            </p>
          ) : null}
        </div>
      )}

      {items ? (
        items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            표시할 고정지출 항목이 없어요.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => {
              const plan = item.subscription_plan_id
                ? planById.get(item.subscription_plan_id)
                : null;
              const secondary = plan?.plan_name ?? item.plan_name;
              return (
                <li
                  key={item.id}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium leading-tight">
                      {plan ? plan.service_name : item.name}
                    </p>
                    {secondary ? (
                      <p className="mt-0.5 truncate text-[12px] leading-tight text-muted-foreground">
                        {secondary}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end leading-tight">
                    <span
                      className={
                        item.amount == null
                          ? "text-[15px] font-semibold tabular-nums text-muted-foreground/70"
                          : "text-[15px] font-semibold tabular-nums"
                      }
                    >
                      {item.amount == null ? "금액 미입력" : formatKRW(item.amount)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </>
  );
}
