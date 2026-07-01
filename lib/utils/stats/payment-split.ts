import type { MonthlyTransaction } from "@/lib/queries/transactions";
import type { PaymentMethod } from "@/lib/utils/payment-method";

/**
 * Pure aggregation for the /stats "결제수단" split (§12.9 확장).
 *
 * TIMEZONE-AGNOSTIC: sums already-fetched VARIABLE transaction amounts by
 * payment method; never parses dates. Fixed expenses carry no payment method,
 * so this split is VARIABLE-ONLY — `total` here equals the dashboard
 * `monthlyTotal` (== variableTotal), NOT grandTotal. The /stats section labels
 * the denominator accordingly so the number isn't read against the grand total.
 *
 * Buckets: credit / debit / unknown (legacy rows with payment_method === null).
 * Only buckets with total > 0 are returned, ordered credit → debit → unknown.
 * `share` is each bucket's % of the variable total (Σ shares ≈ 100, modulo
 * float division — never re-normalized, mirrors aggregateVariableByCategory).
 */

export type PaymentSplitInput = Pick<
  MonthlyTransaction,
  "amount" | "payment_method"
>;

export type PaymentBucket = PaymentMethod | "unknown";

export type PaymentSplitRow = {
  method: PaymentBucket;
  total: number;
  /** 0..100, share of the variable total. */
  share: number;
};

export type PaymentSplit = {
  /** Buckets with total > 0, ordered credit → debit → unknown. */
  rows: PaymentSplitRow[];
  /** Σ of all variable amounts (== dashboard monthlyTotal). */
  total: number;
};

const BUCKET_ORDER: PaymentBucket[] = ["credit", "debit", "unknown"];

export function aggregatePaymentSplit(
  transactions: PaymentSplitInput[],
): PaymentSplit {
  const totals: Record<PaymentBucket, number> = {
    credit: 0,
    debit: 0,
    unknown: 0,
  };
  for (const tx of transactions) {
    const bucket: PaymentBucket = tx.payment_method ?? "unknown";
    totals[bucket] += tx.amount;
  }

  const total = totals.credit + totals.debit + totals.unknown;
  const rows = BUCKET_ORDER.filter((b) => totals[b] > 0).map((b) => ({
    method: b,
    total: totals[b],
    share: total > 0 ? (totals[b] / total) * 100 : 0,
  }));

  return { rows, total };
}
