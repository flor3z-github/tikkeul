import { describe, expect, it } from "vitest";

import {
  cycleSpendTrend,
  spendTrend,
  spendTrendLabel,
  spendTrendManwon,
} from "@/lib/utils/stats/trend";

// TZ-agnostic: this module sums/rounds already-computed numbers, never touching
// dates. The elapsed-window clamp (its only date-sensitive input) is TZ-tested
// in elapsed-window.test.ts; the cycle bounds in payday-cycle.test.ts.

describe("cycleSpendTrend — 총액 추세 델타 (고정 matched-only + 변동 같은-경과)", () => {
  it("sums fixed matched-delta and the elapsed variable difference", () => {
    // 실제 만경이 케이스 재현: 변동 528,306 vs 직전 경과 68,000, 고정 matched −9,990.
    expect(
      cycleSpendTrend({
        curVariable: 528_306,
        prevVariableElapsed: 68_000,
        fixedDeltaWon: -9_990,
      }),
    ).toBe(450_316);
  });

  it("is negative when this cycle is pacing below the previous one", () => {
    expect(
      cycleSpendTrend({
        curVariable: 50_000,
        prevVariableElapsed: 90_000,
        fixedDeltaWon: 0,
      }),
    ).toBe(-40_000);
  });

  it("counts only the fixed change, not the fixed total (artifact #1 already folded in)", () => {
    // fixedDeltaWon is matched-only upstream; here it's just additive.
    expect(
      cycleSpendTrend({
        curVariable: 0,
        prevVariableElapsed: 0,
        fixedDeltaWon: 820,
      }),
    ).toBe(820);
  });
});

describe("spendTrendManwon — 만원 반올림", () => {
  it("rounds to the nearest 만원", () => {
    expect(spendTrendManwon(34_000)).toBe(3);
    expect(spendTrendManwon(36_000)).toBe(4);
    expect(spendTrendManwon(-34_000)).toBe(-3);
  });
  it("rounds sub-만원 noise to 0", () => {
    expect(spendTrendManwon(4_999)).toBe(0);
    expect(spendTrendManwon(-4_999)).toBe(0);
    expect(spendTrendManwon(0)).toBe(0);
  });
  it("rounds the half-만원 boundary up", () => {
    expect(spendTrendManwon(5_000)).toBe(1);
  });
});

describe("spendTrendLabel — 페이스 카피", () => {
  it('says "더 쓰는 중" for a positive delta', () => {
    expect(spendTrendLabel(30_000)).toBe("지난 주기 같은 때보다 3만원 더 쓰는 중");
  });
  it('says "덜 쓰는 중" for a negative delta', () => {
    expect(spendTrendLabel(-30_000)).toBe("지난 주기 같은 때보다 3만원 덜 쓰는 중");
  });
  it('collapses sub-만원 to "비슷하게 쓰는 중" (no "0만원 더")', () => {
    expect(spendTrendLabel(4_999)).toBe("지난 주기 같은 때랑 비슷하게 쓰는 중");
    expect(spendTrendLabel(0)).toBe("지난 주기 같은 때랑 비슷하게 쓰는 중");
  });
  it('uses "달" unit for calendar mode', () => {
    expect(spendTrendLabel(30_000, "달")).toBe("지난 달 같은 때보다 3만원 더 쓰는 중");
  });
});

describe("spendTrend — 구조화 파트(숫자 강조용)", () => {
  it("splits the amount out for a positive delta (up)", () => {
    expect(spendTrend(30_000)).toEqual({
      kind: "up",
      prefix: "지난 주기 같은 때보다 ",
      amount: "3만원",
      suffix: " 더 쓰는 중",
    });
  });
  it("splits the amount out for a negative delta (down)", () => {
    expect(spendTrend(-30_000, "달")).toEqual({
      kind: "down",
      prefix: "지난 달 같은 때보다 ",
      amount: "3만원",
      suffix: " 덜 쓰는 중",
    });
  });
  it("returns a flat text line for sub-만원 noise", () => {
    expect(spendTrend(4_999)).toEqual({
      kind: "flat",
      text: "지난 주기 같은 때랑 비슷하게 쓰는 중",
    });
  });
  it("stays consistent with spendTrendLabel (same assembled string)", () => {
    for (const d of [120_000, -85_000, 0, 5_000, -4_999]) {
      const t = spendTrend(d);
      const assembled =
        t.kind === "flat" ? t.text : `${t.prefix}${t.amount}${t.suffix}`;
      expect(assembled).toBe(spendTrendLabel(d));
    }
  });
});
