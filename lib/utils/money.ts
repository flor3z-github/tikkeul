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
