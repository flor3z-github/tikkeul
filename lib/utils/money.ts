const krwFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
});

export function formatKRW(amount: number): string {
  if (!Number.isFinite(amount)) return "0원";
  return krwFormatter.format(Math.round(amount));
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
