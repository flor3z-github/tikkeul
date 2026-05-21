export type BudgetSummary = {
  monthlyIncome: number;
  extraIncome: number;
  effectiveIncome: number;
  fixedExpense: number;
  availableBudget: number;
  monthlyExpense: number;
  totalSpent: number;
  spendingRate: number;
  remainingBudget: number;
};

export type SpendingStatus = "normal" | "caution" | "warning" | "over";

export function calculateBudgetSummary(input: {
  monthlyIncome: number;
  fixedExpense: number;
  monthlyExpense: number;
  /**
   * Per-cycle one-shot income (bonus, refund, side income) summed from
   * `income_adjustments` whose `occurred_on` falls inside the current cycle.
   * Optional; defaults to 0 so existing callers keep working unchanged.
   */
  extraIncome?: number;
}): BudgetSummary {
  const monthlyIncome = Math.max(0, input.monthlyIncome ?? 0);
  const fixedExpense = Math.max(0, input.fixedExpense ?? 0);
  const monthlyExpense = Math.max(0, input.monthlyExpense ?? 0);
  const extraIncome = Math.max(0, input.extraIncome ?? 0);

  const effectiveIncome = monthlyIncome + extraIncome;
  const availableBudget = Math.max(0, effectiveIncome - fixedExpense);
  const totalSpent = fixedExpense + monthlyExpense;
  const remainingBudget = effectiveIncome - totalSpent;
  const spendingRate =
    effectiveIncome > 0 ? (totalSpent / effectiveIncome) * 100 : 0;

  return {
    monthlyIncome,
    extraIncome,
    effectiveIncome,
    fixedExpense,
    availableBudget,
    monthlyExpense,
    totalSpent,
    spendingRate,
    remainingBudget,
  };
}

export function getSpendingStatus(spendingRate: number): SpendingStatus {
  if (spendingRate >= 100) return "over";
  if (spendingRate >= 90) return "warning";
  if (spendingRate >= 60) return "caution";
  return "normal";
}
