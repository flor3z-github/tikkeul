import { describe, expect, it } from "vitest";

import {
  SPLIT_MAX_PEOPLE,
  SPLIT_MIN_PEOPLE,
  computeShare,
  isValidSplitCount,
} from "./split";

describe("computeShare", () => {
  it("divides evenly by N and rounds", () => {
    expect(computeShare(40_000, 4)).toBe(10_000);
    expect(computeShare(30_000, 3)).toBe(10_000);
    expect(computeShare(20_000, 2)).toBe(10_000);
  });

  it("rounds to nearest won for uneven splits", () => {
    // 40001 / 4 = 10000.25 → 10000
    expect(computeShare(40_001, 4)).toBe(10_000);
    // 10000 / 3 = 3333.33 → 3333
    expect(computeShare(10_000, 3)).toBe(3_333);
    // 10001 / 3 = 3333.67 → 3334
    expect(computeShare(10_001, 3)).toBe(3_334);
  });

  it("returns the total unchanged for 1 person (no split)", () => {
    expect(computeShare(40_000, 1)).toBe(40_000);
  });

  it("returns 0 for invalid total", () => {
    expect(computeShare(0, 3)).toBe(0);
    expect(computeShare(-100, 3)).toBe(0);
    expect(computeShare(Number.NaN, 3)).toBe(0);
    expect(computeShare(Number.POSITIVE_INFINITY, 3)).toBe(0);
  });

  it("returns 0 for invalid people count", () => {
    expect(computeShare(40_000, 0)).toBe(0);
    expect(computeShare(40_000, -2)).toBe(0);
    expect(computeShare(40_000, 2.5)).toBe(0);
  });
});

describe("isValidSplitCount", () => {
  it("accepts 2..SPLIT_MAX_PEOPLE integers", () => {
    for (let n = SPLIT_MIN_PEOPLE; n <= SPLIT_MAX_PEOPLE; n += 1) {
      expect(isValidSplitCount(n)).toBe(true);
    }
  });

  it("rejects 1 (no-split), 0, and above the max", () => {
    expect(isValidSplitCount(1)).toBe(false);
    expect(isValidSplitCount(0)).toBe(false);
    expect(isValidSplitCount(SPLIT_MAX_PEOPLE + 1)).toBe(false);
  });

  it("rejects null, non-integers, and non-numbers", () => {
    expect(isValidSplitCount(null)).toBe(false);
    expect(isValidSplitCount(undefined)).toBe(false);
    expect(isValidSplitCount(2.5)).toBe(false);
    expect(isValidSplitCount("3")).toBe(false);
  });
});
