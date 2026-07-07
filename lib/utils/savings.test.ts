import { describe, expect, it } from "vitest";

import {
  depositsOnDate,
  remainingLabel,
  thisMonthSaved,
  type SavingsPlanRow,
} from "./savings";

function plan(overrides: Partial<SavingsPlanRow> = {}): SavingsPlanRow {
  return {
    id: "p",
    name: "적금",
    amount: 100_000,
    payment_day: null,
    start_date: "2026-01-10",
    maturity_date: null,
    is_active: true,
    ...overrides,
  };
}

// Local-component date (TZ-independent: functions read getFullYear/Month/Date).
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("remainingLabel", () => {
  it("counts whole months to maturity", () => {
    const p = plan({ maturity_date: "2026-11-10" });
    expect(remainingLabel(p, at(2026, 6, 10))).toBe("만기까지 5개월");
  });
  it("floors 0 once the maturity date is reached/passed", () => {
    const p = plan({ maturity_date: "2026-06-10" });
    expect(remainingLabel(p, at(2026, 6, 10))).toBe("만기까지 0개월");
    expect(remainingLabel(p, at(2026, 12, 1))).toBe("만기까지 0개월");
  });
  it("is null with no maturity date (자유 적립/투자)", () => {
    expect(remainingLabel(plan(), at(2026, 6, 10))).toBeNull();
  });
});

describe("thisMonthSaved", () => {
  it("sums active, started, not-yet-matured plans' monthly amount", () => {
    const plans = [
      plan({ id: "a", amount: 300_000 }),
      plan({ id: "b", amount: 200_000 }),
      plan({ id: "c", amount: 999_000, is_active: false }), // inactive
      plan({ id: "d", amount: 500_000, start_date: "2026-09-01" }), // not started
      plan({ id: "e", amount: 700_000, maturity_date: "2026-03-10" }), // matured
    ];
    expect(thisMonthSaved(plans, at(2026, 6, 10))).toBe(500_000); // a + b
  });
  it("treats a NULL amount as 0", () => {
    expect(thisMonthSaved([plan({ amount: null })], at(2026, 6, 10))).toBe(0);
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
});
