import { describe, expect, it } from "vitest";

import {
  formatAmountInput,
  formatKRW,
  formatNumber,
  parseAmountInput,
} from "@/lib/utils/money";

describe("formatAmountInput", () => {
  it("returns '' for input with no digits", () => {
    expect(formatAmountInput("")).toBe("");
    expect(formatAmountInput("abc")).toBe("");
  });

  it("keeps an explicit '0' (only an empty input clears)", () => {
    expect(formatAmountInput("0")).toBe("0");
    expect(formatAmountInput("00")).toBe("0");
    expect(formatAmountInput("007")).toBe("7");
  });

  it("groups digits with thousands separators", () => {
    expect(formatAmountInput("12000")).toBe("12,000");
    expect(formatAmountInput("1000000")).toBe("1,000,000");
  });

  it("re-formats an already-formatted value idempotently", () => {
    expect(formatAmountInput("12,000")).toBe("12,000");
  });

  it("strips interleaved non-digits before grouping", () => {
    expect(formatAmountInput("1a2b3")).toBe("123");
  });
});

describe("parseAmountInput", () => {
  it("reads the integer, treating empty/non-digit as 0", () => {
    expect(parseAmountInput("")).toBe(0);
    expect(parseAmountInput("abc")).toBe(0);
    expect(parseAmountInput("12,000")).toBe(12000);
    expect(parseAmountInput("1a2b3")).toBe(123);
  });
});

describe("formatNumber", () => {
  it("groups digits and rounds; non-finite → '0'", () => {
    expect(formatNumber(12000)).toBe("12,000");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(NaN)).toBe("0");
    expect(formatNumber(1000000.4)).toBe("1,000,000");
  });
});

describe("formatKRW", () => {
  it("appends the 원 suffix; non-finite → '0원'", () => {
    expect(formatKRW(12000)).toBe("12,000원");
    expect(formatKRW(0)).toBe("0원");
    expect(formatKRW(Infinity)).toBe("0원");
  });
});
