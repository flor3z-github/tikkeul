const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
});

// Korean convention: number first, "원" suffix (e.g. "12,000원"). The ₩
// glyph prefix from Intl currency formatter is unidiomatic for in-app
// content and clutters mobile typography.
export function formatKRW(amount: number): string {
  if (!Number.isFinite(amount)) return "0원";
  return `${numberFormatter.format(Math.round(amount))}원`;
}

export function formatNumber(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  return numberFormatter.format(Math.round(amount));
}

export function parseAmountInput(value: string): number {
  const cleaned = value.replace(/[^0-9]/g, "");
  if (!cleaned) return 0;
  return Number.parseInt(cleaned, 10);
}

/**
 * Format a raw amount-input string for a controlled text field. Groups digits
 * ("12000" → "12,000"), but an input that contains no digits stays "" instead
 * of snapping to a literal "0" — so backspacing the field clear actually clears
 * it and the placeholder reappears. Typing "0" still shows "0"; only an empty
 * input yields "". Submit paths keep using parseAmountInput to read the integer.
 */
export function formatAmountInput(value: string): string {
  const cleaned = value.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  return numberFormatter.format(Number.parseInt(cleaned, 10));
}
