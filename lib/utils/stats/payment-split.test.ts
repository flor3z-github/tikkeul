import { describe, expect, it } from "vitest";

import {
  aggregatePaymentSplit,
  type PaymentSplitInput,
} from "@/lib/utils/stats/payment-split";

// TIMEZONE-AGNOSTIC, like cycle-breakdown: groups already-fetched rows by
// payment method and sums amounts, never touching dates. Only aggregation,
// ordering, share, and the Σ invariant below.

function tx(
  amount: number,
  payment_method: PaymentSplitInput["payment_method"],
): PaymentSplitInput {
  return { amount, payment_method };
}

describe("aggregatePaymentSplit", () => {
  it("returns empty rows and zero total for no transactions", () => {
    const split = aggregatePaymentSplit([]);
    expect(split.rows).toEqual([]);
    expect(split.total).toBe(0);
  });

  it("collapses a single method into one 100% row", () => {
    const split = aggregatePaymentSplit([tx(1000, "credit"), tx(500, "credit")]);
    expect(split.total).toBe(1500);
    expect(split.rows).toHaveLength(1);
    expect(split.rows[0]).toEqual({ method: "credit", total: 1500, share: 100 });
  });

  it("splits credit and debit with shares of the variable total", () => {
    const split = aggregatePaymentSplit([
      tx(6000, "credit"),
      tx(4000, "debit"),
    ]);
    expect(split.total).toBe(10000);
    expect(split.rows.map((r) => r.method)).toEqual(["credit", "debit"]);
    expect(split.rows[0].share).toBeCloseTo(60);
    expect(split.rows[1].share).toBeCloseTo(40);
  });

  it("buckets null payment_method as 'unknown' (legacy rows)", () => {
    const split = aggregatePaymentSplit([tx(3000, null)]);
    expect(split.rows).toEqual([{ method: "unknown", total: 3000, share: 100 }]);
  });

  it("orders buckets credit → debit → unknown regardless of input order", () => {
    const split = aggregatePaymentSplit([
      tx(100, null),
      tx(100, "debit"),
      tx(100, "credit"),
    ]);
    expect(split.rows.map((r) => r.method)).toEqual([
      "credit",
      "debit",
      "unknown",
    ]);
  });

  it("omits buckets with no spending", () => {
    const split = aggregatePaymentSplit([tx(1000, "debit")]);
    expect(split.rows.map((r) => r.method)).toEqual(["debit"]);
  });

  it("keeps Σ row.total === total (no rows dropped from the sum)", () => {
    const rows = [
      tx(1234, "credit"),
      tx(5678, "debit"),
      tx(9012, null),
      tx(3456, "credit"),
    ];
    const split = aggregatePaymentSplit(rows);
    const summed = split.rows.reduce((s, r) => s + r.total, 0);
    expect(summed).toBe(split.total);
    expect(split.total).toBe(1234 + 5678 + 9012 + 3456);
  });
});
