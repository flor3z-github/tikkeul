// Shared types for the fixed-expenses module.

export type SubscriptionPlan = {
  id: string;
  service_name: string;
  plan_name: string | null;
  default_amount: number;
  category: string | null;
  sort_order: number;
  aliases: string[];
};

export type FixedExpenseRow = {
  id: string;
  subscription_plan_id: string | null;
  name: string;
  plan_name: string | null;
  /** Monthly base amount. NULL = "금액 미입력" (add now, fill the amount later). */
  amount: number | null;
  category: string | null;
  is_active: boolean;
  /** Monthly payment day. NULL = unset, 0 = end of month, 1..31 = that day. */
  payment_day: number | null;
};

export function planLabel(plan: SubscriptionPlan): string {
  return plan.plan_name
    ? `${plan.service_name} ${plan.plan_name}`
    : plan.service_name;
}
