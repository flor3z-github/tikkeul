/**
 * 결제수단 (payment method) — 신용카드(credit) / 체크카드(debit).
 *
 * Stored on `transactions.payment_method` (text, nullable). Legacy rows created
 * before this column existed are `null` → surfaced as "미지정" in /stats. Every
 * NEW transaction carries a method (the form requires one), so the credit/debit
 * ratio is meaningful going forward.
 *
 * This module is the single allowlist source — the server action validates
 * against it, the form renders its options from it, and /stats labels its
 * buckets with it. Mirrors the `CATEGORY_ICON_SLUGS` central-constant pattern.
 */

export const PAYMENT_METHODS = ["credit", "debit"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Full labels (form selector). */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  credit: "신용카드",
  debit: "체크카드",
};

/** Short labels (compact /stats rows). */
export const PAYMENT_METHOD_SHORT_LABELS: Record<PaymentMethod, string> = {
  credit: "신용",
  debit: "체크",
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "credit" || value === "debit";
}
