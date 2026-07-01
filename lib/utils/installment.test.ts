import { describe, expect, it } from "vitest";

import {
  installmentSchedule,
  INSTALLMENT_MAX_MONTHS,
} from "@/lib/utils/installment";

// Dates are built with local `new Date(y, m, d)` + toISODate (local), so the
// asserted "YYYY-MM-DD" strings are stable under both TZ=Asia/Seoul and TZ=UTC
// (this file runs in both via test:run / test:utc).

const sum = (rows: { amount: number }[]) =>
  rows.reduce((s, r) => s + r.amount, 0);

describe("installmentSchedule", () => {
  it("Σ회차 === 원금 (even split, no remainder)", () => {
    const rows = installmentSchedule(1_200_000, 12, new Date(2026, 0, 15));
    expect(rows).toHaveLength(12);
    expect(sum(rows)).toBe(1_200_000);
    expect(rows.every((r) => r.amount === 100_000)).toBe(true);
  });

  it("우수리는 첫 회차에 몰린다 (1000/3 → 334,333,333)", () => {
    const rows = installmentSchedule(1000, 3, new Date(2026, 0, 10));
    expect(rows.map((r) => r.amount)).toEqual([334, 333, 333]);
    expect(sum(rows)).toBe(1000);
  });

  it("Σ === 원금 for assorted non-divisible principals", () => {
    for (const [p, n] of [
      [1000, 3],
      [999_999, 7],
      [55_555, 6],
      [123_457, 11],
    ] as const) {
      const rows = installmentSchedule(p, n, new Date(2026, 2, 20));
      expect(sum(rows)).toBe(p);
      expect(rows[0].amount).toBeGreaterThanOrEqual(rows[1].amount);
    }
  });

  it("seq는 1..N, 첫 회차 = 구매월 (구매월 시작)", () => {
    const rows = installmentSchedule(300_000, 3, new Date(2026, 5, 15)); // 6월
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3]);
    expect(rows[0].spentAt).toBe("2026-06-15");
  });

  it("월말 없는 날은 clamp (1/31 시작 → 1/31, 2/28, 3/31)", () => {
    const rows = installmentSchedule(300_000, 3, new Date(2026, 0, 31));
    expect(rows.map((r) => r.spentAt)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("윤년 2월은 29일로 clamp (2028)", () => {
    const rows = installmentSchedule(200_000, 2, new Date(2028, 0, 31));
    expect(rows.map((r) => r.spentAt)).toEqual(["2028-01-31", "2028-02-29"]);
  });

  it("연도 경계를 넘는다 (11월 시작 3개월)", () => {
    const rows = installmentSchedule(300_000, 3, new Date(2026, 10, 15));
    expect(rows.map((r) => r.spentAt)).toEqual([
      "2026-11-15",
      "2026-12-15",
      "2027-01-15",
    ]);
  });

  it("throws on months < 2 (일시불은 할부 아님)", () => {
    expect(() => installmentSchedule(1000, 1, new Date(2026, 0, 1))).toThrow();
    expect(() => installmentSchedule(1000, 0, new Date(2026, 0, 1))).toThrow();
  });

  it("throws on months > max", () => {
    expect(() =>
      installmentSchedule(1_000_000, INSTALLMENT_MAX_MONTHS + 1, new Date(2026, 0, 1)),
    ).toThrow();
  });

  it("throws when principal < months (회차 < 1원)", () => {
    expect(() => installmentSchedule(5, 6, new Date(2026, 0, 1))).toThrow();
  });

  it("throws on non-integer principal", () => {
    expect(() => installmentSchedule(1000.5, 3, new Date(2026, 0, 1))).toThrow();
  });
});
