import { describe, expect, it } from "vitest";

import { calculateBudgetSummary, getSpendingStatus } from "./budget";

describe("calculateBudgetSummary", () => {
  describe("savings omitted/0 is identical to pre-savings behavior", () => {
    // Pins the refactor: when savings is absent (every non-dashboard caller and
    // any non-savings user), totalSpent / spendingRate / remainingBudget must
    // match the old formulas exactly — savings only ADDS behavior, never changes
    // the no-savings path.
    it("derives the legacy fields with no savings input", () => {
      const s = calculateBudgetSummary({
        monthlyIncome: 3_000_000,
        fixedExpense: 445_610,
        monthlyExpense: 644_340,
      });
      expect(s.savings).toBe(0);
      expect(s.totalSpent).toBe(445_610 + 644_340); // 고정 + 소비
      expect(s.outflow).toBe(s.totalSpent); // no savings → outflow ≡ totalSpent
      expect(s.remainingBudget).toBe(3_000_000 - (445_610 + 644_340));
      expect(s.spendingRate).toBeCloseTo(((445_610 + 644_340) / 3_000_000) * 100);
      expect(s.availableBudget).toBe(3_000_000 - 445_610);
    });

    it("treats savings: 0 the same as omitting it", () => {
      const base = {
        monthlyIncome: 2_500_000,
        fixedExpense: 300_000,
        monthlyExpense: 500_000,
        extraIncome: 100_000,
      };
      expect(calculateBudgetSummary({ ...base, savings: 0 })).toEqual(
        calculateBudgetSummary(base),
      );
    });
  });

  describe("with savings > 0", () => {
    // Handoff scenario: income 3,000,000; savings 1,000,000 (청년희망적금 700k +
    // ISA 300k); 실제 고정 445,610; 소비 644,340.
    const s = calculateBudgetSummary({
      monthlyIncome: 3_000_000,
      fixedExpense: 445_610,
      monthlyExpense: 644_340,
      savings: 1_000_000,
    });

    it("adds savings into outflow (the hero 나간 돈)", () => {
      expect(s.savings).toBe(1_000_000);
      expect(s.outflow).toBe(1_000_000 + 445_610 + 644_340); // 2,089,950
    });

    it("excludes savings from totalSpent / spendingRate (consumption only)", () => {
      expect(s.totalSpent).toBe(445_610 + 644_340); // 1,089,950 — savings NOT here
      expect(s.spendingRate).toBeCloseTo(
        ((445_610 + 644_340) / 3_000_000) * 100, // ≈ 36.3%, not 70%
      );
      // The badge must read off consumption, so a heavy saver stays "normal".
      expect(getSpendingStatus(s.spendingRate)).toBe("normal");
    });

    it("deducts savings from remainingBudget (cash committed to the asset)", () => {
      expect(s.remainingBudget).toBe(3_000_000 - (1_000_000 + 445_610 + 644_340));
    });

    it("leaves availableBudget = income − fixed (savings-agnostic)", () => {
      expect(s.availableBudget).toBe(3_000_000 - 445_610);
    });
  });

  it("folds extraIncome into the denominator and deducts savings", () => {
    const s = calculateBudgetSummary({
      monthlyIncome: 2_000_000,
      fixedExpense: 200_000,
      monthlyExpense: 300_000,
      extraIncome: 500_000,
      savings: 400_000,
    });
    expect(s.effectiveIncome).toBe(2_500_000);
    expect(s.outflow).toBe(400_000 + 200_000 + 300_000);
    expect(s.remainingBudget).toBe(2_500_000 - 900_000);
    expect(s.spendingRate).toBeCloseTo((500_000 / 2_500_000) * 100); // 20%, savings out
  });

  it("clamps negative/NaN inputs to 0", () => {
    const s = calculateBudgetSummary({
      monthlyIncome: -100,
      fixedExpense: -50,
      monthlyExpense: -10,
      savings: -999,
    });
    expect(s.savings).toBe(0);
    expect(s.outflow).toBe(0);
    expect(s.spendingRate).toBe(0); // income 0 → no division
  });
});
