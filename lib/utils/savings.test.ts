import { describe, expect, it } from "vitest";

import {
  accruedAmount,
  depositCount,
  depositsOnDate,
  isGoalType,
  progressPct,
  remainingLabel,
  thisMonthSaved,
  yearSaved,
  type SavingsPlanRow,
} from "./savings";

function plan(overrides: Partial<SavingsPlanRow> = {}): SavingsPlanRow {
  return {
    id: "p",
    name: "적금",
    amount: 100_000,
    payment_day: null,
    start_date: "2026-01-10",
    opening_balance: 0,
    goal_amount: null,
    maturity_date: null,
    is_active: true,
    ...overrides,
  };
}

// Local-component date (TZ-independent: functions read getFullYear/Month/Date).
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("depositCount", () => {
  it("is 0 before the first deposit", () => {
    expect(depositCount(plan(), at(2026, 1, 9))).toBe(0);
    expect(depositCount(plan(), at(2025, 12, 31))).toBe(0);
  });

  it("counts the start month once the deposit day is reached", () => {
    expect(depositCount(plan(), at(2026, 1, 10))).toBe(1);
    expect(depositCount(plan(), at(2026, 1, 31))).toBe(1);
  });

  it("counts one deposit per elapsed month", () => {
    expect(depositCount(plan(), at(2026, 2, 9))).toBe(1); // Feb day not reached
    expect(depositCount(plan(), at(2026, 2, 10))).toBe(2);
    expect(depositCount(plan(), at(2026, 12, 10))).toBe(12);
  });

  it("uses payment_day over the start day when set", () => {
    const p = plan({ start_date: "2026-01-20", payment_day: 5 });
    expect(depositCount(p, at(2026, 1, 20))).toBe(1); // start month, day 5 already passed
    expect(depositCount(p, at(2026, 2, 4))).toBe(1); // Feb 5 not yet
    expect(depositCount(p, at(2026, 2, 5))).toBe(2);
  });

  it("clamps payment_day to the month length", () => {
    const p = plan({ start_date: "2026-01-31", payment_day: 31 });
    // Feb has no 31 → deposit falls on Feb 28 (2026 is not a leap year).
    expect(depositCount(p, at(2026, 2, 27))).toBe(1);
    expect(depositCount(p, at(2026, 2, 28))).toBe(2);
  });

  it("treats 말일 (0) as the last day of each month", () => {
    const p = plan({ start_date: "2026-01-31", payment_day: 0 });
    expect(depositCount(p, at(2026, 2, 27))).toBe(1);
    expect(depositCount(p, at(2026, 2, 28))).toBe(2); // Feb 말일
  });
});

describe("accruedAmount", () => {
  it("is monthly × deposits", () => {
    expect(accruedAmount(plan({ amount: 100_000 }), at(2026, 3, 10))).toBe(300_000);
  });

  it("treats a NULL amount as 0", () => {
    expect(accruedAmount(plan({ amount: null }), at(2026, 6, 10))).toBe(0);
  });

  it("caps at goal_amount", () => {
    const p = plan({ amount: 100_000, goal_amount: 250_000 });
    expect(accruedAmount(p, at(2026, 6, 10))).toBe(250_000); // 6 deposits = 600k, capped
  });

  it("adds the opening balance for a savings already in progress", () => {
    // Started today with 9,800,000 already saved, +700k/month.
    const p = plan({
      amount: 700_000,
      opening_balance: 9_800_000,
      start_date: "2026-06-10",
    });
    expect(accruedAmount(p, at(2026, 6, 10))).toBe(10_500_000); // 9.8M + 1 deposit
    expect(accruedAmount(p, at(2026, 8, 10))).toBe(11_900_000); // 9.8M + 3 deposits
  });

  it("caps opening_balance + deposits at goal_amount", () => {
    const p = plan({
      amount: 100_000,
      opening_balance: 900_000,
      goal_amount: 1_000_000,
    });
    expect(accruedAmount(p, at(2026, 6, 10))).toBe(1_000_000); // 900k + 600k capped
  });
});

describe("isGoalType", () => {
  it("is true with a goal amount or a maturity date", () => {
    expect(isGoalType(plan({ goal_amount: 1_000_000 }))).toBe(true);
    expect(isGoalType(plan({ maturity_date: "2027-01-10" }))).toBe(true);
  });
  it("is false for open-ended 자유적립", () => {
    expect(isGoalType(plan())).toBe(false);
  });
});

describe("progressPct", () => {
  it("is amount-based when goal_amount is set", () => {
    const p = plan({ amount: 100_000, goal_amount: 1_000_000 });
    expect(progressPct(p, at(2026, 3, 10))).toBe(30); // 300k / 1,000k
  });
  it("clamps to 100", () => {
    const p = plan({ amount: 100_000, goal_amount: 200_000 });
    expect(progressPct(p, at(2026, 6, 10))).toBe(100);
  });
  it("is time-based against maturity when there is no goal amount", () => {
    const p = plan({ start_date: "2026-01-10", maturity_date: "2026-11-10" });
    // total = 10 months; by Jun 10 → 6 deposits elapsed → 60%.
    expect(progressPct(p, at(2026, 6, 10))).toBe(60);
  });
  it("does not reach 100% before the maturity date (caps at 99)", () => {
    const p = plan({ start_date: "2026-01-10", maturity_date: "2026-11-10" });
    // Oct 10 → 10 deposits / 10 total = 100, but maturity is Nov 10, and
    // remainingLabel still reads "만기까지 1개월" — so progress must not claim
    // completion yet. Capped to 99 until the maturity date is reached.
    expect(progressPct(p, at(2026, 10, 10))).toBe(99);
  });
  it("reaches 100% on the maturity date", () => {
    const p = plan({ start_date: "2026-01-10", maturity_date: "2026-11-10" });
    expect(progressPct(p, at(2026, 11, 10))).toBe(100);
  });
  it("is null for open-ended 자유적립", () => {
    expect(progressPct(plan(), at(2026, 6, 10))).toBeNull();
  });
});

describe("remainingLabel", () => {
  it("counts months to maturity", () => {
    const p = plan({ maturity_date: "2026-11-10" });
    expect(remainingLabel(p, at(2026, 6, 10))).toBe("만기까지 5개월");
  });
  it("estimates months to a goal from the monthly amount", () => {
    const p = plan({ amount: 100_000, goal_amount: 1_000_000 });
    // accrued by Mar 10 = 300k; left 700k / 100k = 7 months.
    expect(remainingLabel(p, at(2026, 3, 10))).toBe("목표까지 약 7개월");
  });
  it("is null for open-ended 자유적립", () => {
    expect(remainingLabel(plan(), at(2026, 6, 10))).toBeNull();
  });
});

describe("thisMonthSaved", () => {
  it("sums active, started, not-yet-matured plans' monthly amount", () => {
    const plans = [
      plan({ id: "a", amount: 300_000 }),
      plan({ id: "b", amount: 200_000 }),
      plan({ id: "c", amount: 999_000, is_active: false }), // inactive
      plan({ id: "d", amount: 500_000, start_date: "2026-09-01" }), // not started yet
      plan({ id: "e", amount: 700_000, maturity_date: "2026-03-10" }), // matured
    ];
    expect(thisMonthSaved(plans, at(2026, 6, 10))).toBe(500_000); // a + b
  });
});

describe("yearSaved", () => {
  it("counts only this year's deposits for a plan started last year", () => {
    const p = plan({ amount: 100_000, start_date: "2025-10-10" });
    // By Mar 10 2026: deposits Jan,Feb,Mar 2026 = 3 → 300k (2025 ones excluded).
    expect(yearSaved([p], at(2026, 3, 10))).toBe(300_000);
  });
  it("counts from the start month for a plan started this year", () => {
    const p = plan({ amount: 100_000, start_date: "2026-02-10" });
    expect(yearSaved([p], at(2026, 4, 10))).toBe(300_000); // Feb,Mar,Apr
  });

  it("excludes the opening balance (a stock, not a flow)", () => {
    const p = plan({
      amount: 100_000,
      opening_balance: 9_000_000,
      start_date: "2026-02-10",
    });
    expect(yearSaved([p], at(2026, 4, 10))).toBe(300_000); // opening_balance ignored
    expect(thisMonthSaved([p], at(2026, 4, 10))).toBe(100_000); // monthly only
  });
});

describe("depositsOnDate (calendar marker lifespan bound)", () => {
  it("is false before the start date, true on/after it (open-ended)", () => {
    const p = plan({ start_date: "2026-03-10", maturity_date: null });
    expect(depositsOnDate(p, "2026-03-09")).toBe(false);
    expect(depositsOnDate(p, "2026-03-10")).toBe(true); // inclusive
    expect(depositsOnDate(p, "2030-12-31")).toBe(true); // no upper bound
  });

  it("is false after the maturity date, true on/before it", () => {
    const p = plan({ start_date: "2023-08-08", maturity_date: "2028-08-08" });
    expect(depositsOnDate(p, "2026-01-01")).toBe(true);
    expect(depositsOnDate(p, "2028-08-08")).toBe(true); // maturity inclusive
    expect(depositsOnDate(p, "2028-08-09")).toBe(false);
  });

  it("drops the pre-start deposit when payment_day precedes the start day", () => {
    // The ISA case: started 2026-06-18, payment_day=1. The expander lands a
    // deposit on 2026-06-01 (a 1st inside the June cycle), but that date is
    // before the plan existed — so the calendar must NOT mark it. First real
    // deposit is 2026-07-01.
    const isa = plan({
      start_date: "2026-06-18",
      payment_day: 1,
      maturity_date: null,
    });
    expect(depositsOnDate(isa, "2026-06-01")).toBe(false);
    expect(depositsOnDate(isa, "2026-07-01")).toBe(true);
  });
});
