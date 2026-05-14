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
  amount: number;
  category: string | null;
  is_active: boolean;
};

export function planLabel(plan: SubscriptionPlan): string {
  return plan.plan_name
    ? `${plan.service_name} ${plan.plan_name}`
    : plan.service_name;
}
