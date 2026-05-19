// Helpers for the optional `fixed_expenses.payment_day` field.
//
// Storage convention:
//   null  → unspecified
//   0     → end of month (말일)
//   1..31 → that day of the month, clamped to the last day if the month is
//           shorter than the requested day.

export const PAYMENT_DAY_END_OF_MONTH = 0;

export function isValidPaymentDay(value: number | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  return Number.isInteger(value) && value >= 0 && value <= 31;
}

export function formatPaymentDay(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value === PAYMENT_DAY_END_OF_MONTH) return "말일";
  if (value >= 1 && value <= 31) return `${value}일`;
  return null;
}

function lastDayOfMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/**
 * Resolve the next payment date on/after `today` for the given `payment_day`.
 * Returns null when payment_day is unset.
 *
 * - day 0 (말일)  → this month's last day if today <= last day, else next
 *   month's last day (which is unreachable since today <= last day always; we
 *   advance to next month only when today is strictly past the resolved day)
 * - day N (1..31) → this month's N, clamped to the month's last day; if that
 *   resolved date is before today, advance to next month and re-clamp
 */
export function nextPaymentDate(
  today: Date,
  payment_day: number | null | undefined,
): Date | null {
  if (payment_day === null || payment_day === undefined) return null;
  if (!isValidPaymentDay(payment_day)) return null;

  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDay = today.getDate();

  const resolveFor = (y: number, m: number): Date => {
    const last = lastDayOfMonth(y, m);
    const day =
      payment_day === PAYMENT_DAY_END_OF_MONTH ? last : Math.min(payment_day, last);
    return new Date(y, m, day);
  };

  const thisMonth = resolveFor(year, month);
  if (thisMonth.getDate() >= todayDay) return thisMonth;
  return resolveFor(year + (month === 11 ? 1 : 0), (month + 1) % 12);
}

/**
 * Comparator: sorts by next payment date ascending; null payment_day sorts
 * last. Useful for the active-items list so the soonest charge is on top.
 */
export function comparePaymentDayUpcoming(
  today: Date,
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  const da = nextPaymentDate(today, a);
  const db = nextPaymentDate(today, b);
  if (da === null && db === null) return 0;
  if (da === null) return 1;
  if (db === null) return -1;
  return da.getTime() - db.getTime();
}

/**
 * Resolve whether `payment_day` fires on the given calendar `date`, applying
 * end-of-month + clamp semantics.
 */
export function paymentDayMatchesDate(
  payment_day: number | null | undefined,
  date: Date,
): boolean {
  if (payment_day === null || payment_day === undefined) return false;
  if (!isValidPaymentDay(payment_day)) return false;
  const last = lastDayOfMonth(date.getFullYear(), date.getMonth());
  const day = date.getDate();
  if (payment_day === PAYMENT_DAY_END_OF_MONTH) return day === last;
  if (payment_day <= last) return day === payment_day;
  // payment_day > monthLastDay → clamp to last day of this month
  return day === last;
}

function toIsoLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Build a map of `YYYY-MM-DD → items` for every day in `[cycleStart, cycleEnd]`
 * (inclusive) where the item's `payment_day` resolves to that date.
 *
 * The cycle range may span two months (income_day mode), so we iterate days
 * and ask each item whether it matches. Items without a `payment_day` are
 * silently dropped — they are unscheduled by definition.
 */
export function expandFixedExpensesByDay<
  T extends { payment_day: number | null },
>(cycleStart: Date, cycleEnd: Date, items: T[]): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  if (cycleStart > cycleEnd) return result;
  const cursor = new Date(
    cycleStart.getFullYear(),
    cycleStart.getMonth(),
    cycleStart.getDate(),
  );
  const end = new Date(
    cycleEnd.getFullYear(),
    cycleEnd.getMonth(),
    cycleEnd.getDate(),
  );
  while (cursor <= end) {
    const iso = toIsoLocalDate(cursor);
    for (const item of items) {
      if (paymentDayMatchesDate(item.payment_day, cursor)) {
        (result[iso] ??= []).push(item);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
