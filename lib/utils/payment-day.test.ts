import { describe, expect, it } from "vitest";

import { toISODate } from "@/lib/utils/date";
import {
  comparePaymentDayUpcoming,
  expandFixedExpensesByDay,
  formatPaymentDay,
  isValidPaymentDay,
  nextPaymentDate,
  PAYMENT_DAY_END_OF_MONTH,
  paymentDayMatchesDate,
} from "@/lib/utils/payment-day";

describe("isValidPaymentDay", () => {
  it("treats null/undefined as valid (unspecified)", () => {
    expect(isValidPaymentDay(null)).toBe(true);
    expect(isValidPaymentDay(undefined)).toBe(true);
  });
  it("accepts 0 (말일) through 31", () => {
    expect(isValidPaymentDay(PAYMENT_DAY_END_OF_MONTH)).toBe(true);
    expect(isValidPaymentDay(31)).toBe(true);
  });
  it("rejects out-of-range and non-integers", () => {
    expect(isValidPaymentDay(32)).toBe(false);
    expect(isValidPaymentDay(-1)).toBe(false);
    expect(isValidPaymentDay(1.5)).toBe(false);
  });
});

describe("formatPaymentDay", () => {
  it("formats end-of-month, day, and unspecified", () => {
    expect(formatPaymentDay(PAYMENT_DAY_END_OF_MONTH)).toBe("말일");
    expect(formatPaymentDay(25)).toBe("25일");
    expect(formatPaymentDay(null)).toBeNull();
  });
});

describe("nextPaymentDate", () => {
  it("returns this month's day when it is still upcoming", () => {
    const d = nextPaymentDate(new Date(2026, 5, 15), 25)!; // Jun 15
    expect(toISODate(d)).toBe("2026-06-25");
  });
  it("rolls to next month once the day has passed", () => {
    const d = nextPaymentDate(new Date(2026, 5, 26), 25)!; // Jun 26
    expect(toISODate(d)).toBe("2026-07-25");
  });
  it("resolves 말일 to the month's last day", () => {
    const d = nextPaymentDate(new Date(2026, 5, 15), PAYMENT_DAY_END_OF_MONTH)!;
    expect(toISODate(d)).toBe("2026-06-30");
  });
  it("clamps a long day into a short month", () => {
    const d = nextPaymentDate(new Date(2026, 1, 10), 31)!; // Feb 10 (non-leap)
    expect(toISODate(d)).toBe("2026-02-28");
  });
  it("crosses the year boundary", () => {
    const d = nextPaymentDate(new Date(2026, 11, 20), 10)!; // Dec 20
    expect(toISODate(d)).toBe("2027-01-10");
  });
  it("returns null for an unset payment_day", () => {
    expect(nextPaymentDate(new Date(2026, 5, 15), null)).toBeNull();
  });
});

describe("paymentDayMatchesDate", () => {
  it("matches an exact day", () => {
    expect(paymentDayMatchesDate(25, new Date(2026, 4, 25))).toBe(true);
    expect(paymentDayMatchesDate(25, new Date(2026, 4, 24))).toBe(false);
  });
  it("matches 말일 only on the last calendar day", () => {
    expect(
      paymentDayMatchesDate(PAYMENT_DAY_END_OF_MONTH, new Date(2026, 1, 28)),
    ).toBe(true);
    expect(
      paymentDayMatchesDate(PAYMENT_DAY_END_OF_MONTH, new Date(2026, 1, 27)),
    ).toBe(false);
  });
  it("clamps an over-length day onto the month's last day", () => {
    // payment_day 31 in Feb 2026 fires on the 28th.
    expect(paymentDayMatchesDate(31, new Date(2026, 1, 28))).toBe(true);
    expect(paymentDayMatchesDate(31, new Date(2026, 1, 27))).toBe(false);
  });
  it("never matches an unset payment_day", () => {
    expect(paymentDayMatchesDate(null, new Date(2026, 4, 25))).toBe(false);
  });
});

describe("comparePaymentDayUpcoming", () => {
  const today = new Date(2026, 5, 15); // Jun 15
  it("orders by the soonest upcoming charge", () => {
    // 20 → Jun 20 (this month); 10 → Jul 10 (already passed this month).
    expect(comparePaymentDayUpcoming(today, 20, 10)).toBeLessThan(0);
    expect(comparePaymentDayUpcoming(today, 10, 20)).toBeGreaterThan(0);
  });
  it("sorts an unset payment_day last", () => {
    expect(comparePaymentDayUpcoming(today, null, 10)).toBe(1);
    expect(comparePaymentDayUpcoming(today, 10, null)).toBe(-1);
    expect(comparePaymentDayUpcoming(today, null, null)).toBe(0);
  });
});

describe("expandFixedExpensesByDay", () => {
  it("maps each scheduled item onto its firing day (calendar cycle)", () => {
    const items = [
      { id: "rent", payment_day: 15 },
      { id: "card", payment_day: PAYMENT_DAY_END_OF_MONTH },
      { id: "unscheduled", payment_day: null },
    ];
    const map = expandFixedExpensesByDay(
      new Date(2026, 4, 1), // May 1
      new Date(2026, 5, 1), // Jun 1 (exclusive)
      items,
    );
    expect(map["2026-05-15"]?.map((i) => i.id)).toEqual(["rent"]);
    expect(map["2026-05-31"]?.map((i) => i.id)).toEqual(["card"]); // 말일
    // The unscheduled item appears nowhere.
    expect(
      Object.values(map).flat().some((i) => i.id === "unscheduled"),
    ).toBe(false);
  });

  it("handles a two-month income_day cycle", () => {
    const items = [
      { id: "early", payment_day: 10 },
      { id: "eom", payment_day: PAYMENT_DAY_END_OF_MONTH },
    ];
    const map = expandFixedExpensesByDay(
      new Date(2026, 3, 25), // Apr 25
      new Date(2026, 4, 25), // May 25 (exclusive)
      items,
    );
    expect(map["2026-05-10"]?.map((i) => i.id)).toEqual(["early"]);
    expect(map["2026-04-30"]?.map((i) => i.id)).toEqual(["eom"]); // Apr 말일 in range
    // May 10 is in range; Apr 10 is not, so "early" appears once.
    expect(Object.keys(map).filter((k) => map[k].some((i) => i.id === "early")))
      .toEqual(["2026-05-10"]);
  });

  it("returns an empty map for an inverted range", () => {
    expect(
      expandFixedExpensesByDay(new Date(2026, 5, 1), new Date(2026, 4, 1), []),
    ).toEqual({});
  });
});
