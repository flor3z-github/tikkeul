export type BudgetSummary = {
  monthlyIncome: number;
  extraIncome: number;
  effectiveIncome: number;
  fixedExpense: number;
  /**
   * This-cycle savings/investment contribution (sum of active 돈모으기 plans'
   * monthly amount). NOT spending — it becomes the user's own asset. Counts
   * toward `outflow` and is deducted from `remainingBudget`, but is excluded
   * from `totalSpent`/`spendingRate` (the consumption-rate that drives the
   * 주의/위험 badge). Defaults to 0 so non-savings users see no change.
   */
  savings: number;
  availableBudget: number;
  monthlyExpense: number;
  /** Consumption only (고정 + 소비). Drives spendingRate + status badge. */
  totalSpent: number;
  /** Everything that left the wallet this cycle: savings + fixed + spend. */
  outflow: number;
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
  /**
   * This-cycle savings/investment contribution (돈모으기). Optional; defaults
   * to 0. When 0 the result is byte-identical to the pre-savings behavior, so
   * non-savings users and all other callers are unaffected.
   */
  savings?: number;
}): BudgetSummary {
  const monthlyIncome = Math.max(0, input.monthlyIncome ?? 0);
  const fixedExpense = Math.max(0, input.fixedExpense ?? 0);
  const monthlyExpense = Math.max(0, input.monthlyExpense ?? 0);
  const extraIncome = Math.max(0, input.extraIncome ?? 0);
  const savings = Math.max(0, input.savings ?? 0);

  const effectiveIncome = monthlyIncome + extraIncome;
  const availableBudget = Math.max(0, effectiveIncome - fixedExpense);
  // totalSpent = consumption (고정 + 소비). Savings is excluded: it isn't spent,
  // it becomes the user's asset — so the spendingRate/badge don't penalize it.
  const totalSpent = fixedExpense + monthlyExpense;
  // outflow = everything that left the wallet (savings + fixed + spend) = the
  // hero "나간 돈". remainingBudget deducts savings too because that cash is no
  // longer spendable this cycle (committed to the asset).
  const outflow = savings + totalSpent;
  const remainingBudget = effectiveIncome - outflow;
  const spendingRate =
    effectiveIncome > 0 ? (totalSpent / effectiveIncome) * 100 : 0;

  return {
    monthlyIncome,
    extraIncome,
    effectiveIncome,
    fixedExpense,
    savings,
    availableBudget,
    monthlyExpense,
    totalSpent,
    outflow,
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
