export type BudgetSummary = {
  monthlyIncome: number;
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
}): BudgetSummary {
  const monthlyIncome = Math.max(0, input.monthlyIncome ?? 0);
  const fixedExpense = Math.max(0, input.fixedExpense ?? 0);
  const monthlyExpense = Math.max(0, input.monthlyExpense ?? 0);

  const availableBudget = Math.max(0, monthlyIncome - fixedExpense);
  const totalSpent = fixedExpense + monthlyExpense;
  const remainingBudget = monthlyIncome - totalSpent;
  const spendingRate =
    monthlyIncome > 0 ? (totalSpent / monthlyIncome) * 100 : 0;

  return {
    monthlyIncome,
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
