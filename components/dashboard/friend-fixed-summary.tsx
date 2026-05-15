import { Card, CardContent } from "@/components/ui/card";
import {
  type FixedExpenseRow,
  type SubscriptionPlan,
} from "@/components/fixed-expenses/types";
import { formatKRW } from "@/lib/utils/money";

type FriendFixedSummaryProps = {
  total: number;
  items?: FixedExpenseRow[];
  plans?: SubscriptionPlan[];
};

export function FriendFixedSummary({
  total,
  items,
  plans,
}: FriendFixedSummaryProps) {
  const planById = new Map<string, SubscriptionPlan>();
  for (const plan of plans ?? []) planById.set(plan.id, plan);

  return (
    <section className="space-y-3">
      <Card className="rounded-3xl border-black/[0.08] bg-card shadow-none dark:border-white/[0.10]">
        <CardContent className="space-y-2 p-6">
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
        </CardContent>
      </Card>

      {items ? (
        items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            표시할 고정지출 항목이 없어요.
          </p>
        ) : (
          <Card className="rounded-3xl border-black/[0.08] bg-card py-2 shadow-none dark:border-white/[0.10]">
            <CardContent className="p-2">
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
                        <span className="text-[15px] font-semibold tabular-nums">
                          {formatKRW(item.amount)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )
      ) : null}
    </section>
  );
}
