// Pure savings-plan math for the "돈모으기" tab.
//
// Accrual is DERIVED, not stored: the user only records the monthly amount, the
// deposit day, and the start (first-deposit) month. "현재 모은 돈" is then
// monthly × number of deposits that have occurred. This keeps the model small
// and avoids a stale stored balance.
//
// Phase-1 simplifications (documented limits, pinned by tests):
//   - Linear accrual: every month contributes the SAME monthly amount. A
//     mid-stream amount change or an early termination is not modelled.
//   - The deposit day is `payment_day` when set, else the start_date's day,
//     clamped to each month's length (Feb 30 → Feb 28/29; 말일 → last day).
//
// TZ safety: date-only inputs are 'YYYY-MM-DD' strings parsed by splitting (no
// `new Date(string)` — that would parse as UTC and drift under KST). `now` is a
// Date whose LOCAL components are read (callers pass `nowInSeoul()` so the
// components already equal the Asia/Seoul wall clock). Mirrors the holiday-set
// convention in lib/queries/holidays.ts.

import { PAYMENT_DAY_END_OF_MONTH } from "@/lib/utils/payment-day";

export type SavingsPlanRow = {
  id: string;
  name: string;
  /** Monthly contribution. NULL = "금액 미입력" → contributes/accrues 0. */
  amount: number | null;
  /** Deposit day. NULL = unset (falls back to start_date's day), 0 = 말일, 1..31. */
  payment_day: number | null;
  /** First-deposit month, 'YYYY-MM-DD'. */
  start_date: string;
  /**
   * Amount already saved as of start_date (a stock, for savings begun before
   * being recorded here). Counts toward accrued/progress, NOT the flow totals.
   */
  opening_balance: number;
  /** Target amount for 달성형 목표. NULL = 투자·자유 적립 (섹션 A). */
  goal_amount: number | null;
  /** 적금 만기일, 'YYYY-MM-DD'. NULL = open-ended. */
  maturity_date: string | null;
  is_active: boolean;
};

type Ymd = { y: number; m: number; d: number }; // m is 1-based (1..12)

function parseYmd(iso: string): Ymd {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function ymdFromDate(now: Date): Ymd {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

function daysInMonth(y: number, m: number): number {
  // Day 0 of the next month = last day of month m (Date month is 0-based).
  return new Date(y, m, 0).getDate();
}

/** Negative if a < b, 0 if equal, positive if a > b. */
function cmpYmd(a: Ymd, b: Ymd): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

/**
 * The deposit day for plan `p` within month (y, m), clamped to that month's
 * length. payment_day takes priority; otherwise the start_date's day is used.
 */
function depositDayIn(p: SavingsPlanRow, y: number, m: number): number {
  const dim = daysInMonth(y, m);
  if (p.payment_day === PAYMENT_DAY_END_OF_MONTH) return dim; // 말일
  if (p.payment_day != null) return Math.min(p.payment_day, dim);
  return Math.min(parseYmd(p.start_date).d, dim);
}

/** True for 달성형 목표 (섹션 B); false for 투자·자유 적립 (섹션 A). */
export function isGoalType(p: SavingsPlanRow): boolean {
  return p.goal_amount != null || p.maturity_date != null;
}

/**
 * Number of deposits that have occurred from the start month through `now`,
 * inclusive. 0 if `now` is before the first deposit.
 */
export function depositCount(p: SavingsPlanRow, now: Date): number {
  const start = parseYmd(p.start_date);
  const cur = ymdFromDate(now);
  if (cmpYmd(cur, start) < 0) return 0;

  const monthDiff = (cur.y - start.y) * 12 + (cur.m - start.m);
  const thisMonthDeposited = cur.d >= depositDayIn(p, cur.y, cur.m) ? 1 : 0;
  return Math.max(0, monthDiff + thisMonthDeposited);
}

/**
 * Accrued ("모은 돈") = opening_balance + monthly × deposits, capped at
 * goal_amount when set. The opening balance lets a long-running savings start
 * from its current amount. The cap reflects that a finished goal stops growing
 * in the progress view; the cash-flow totals (thisMonthSaved / yearSaved) are
 * NOT capped and exclude opening_balance.
 */
export function accruedAmount(p: SavingsPlanRow, now: Date): number {
  const accrued = (p.opening_balance ?? 0) + (p.amount ?? 0) * depositCount(p, now);
  if (p.goal_amount != null) return Math.min(accrued, p.goal_amount);
  return accrued;
}

/**
 * Goal progress 0..100. Amount-based when goal_amount is set; otherwise
 * time-based against the maturity date. Returns null when neither applies.
 */
export function progressPct(p: SavingsPlanRow, now: Date): number | null {
  if (p.goal_amount != null && p.goal_amount > 0) {
    const pct = (accruedAmount(p, now) / p.goal_amount) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }
  if (p.maturity_date != null) {
    const start = parseYmd(p.start_date);
    const mat = parseYmd(p.maturity_date);
    const total = (mat.y - start.y) * 12 + (mat.m - start.m);
    if (total <= 0) return 100;
    const elapsed = depositCount(p, now);
    return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  }
  return null;
}

/** Whole months from `now` until the target date; 0 once reached/passed. */
function monthsUntil(now: Date, targetIso: string): number {
  const cur = ymdFromDate(now);
  const t = parseYmd(targetIso);
  let months = (t.y - cur.y) * 12 + (t.m - cur.m);
  if (t.d < cur.d) months -= 1; // the day-of-month for the final period hasn't arrived
  return Math.max(0, months);
}

/**
 * Right-aligned label for a 달성형 목표 row.
 *   - maturity_date set → "만기까지 N개월"
 *   - else goal_amount  → "목표까지 약 N개월" = ⌈(goal − accrued) / monthly⌉
 *   - neither / no monthly → null
 */
export function remainingLabel(p: SavingsPlanRow, now: Date): string | null {
  if (p.maturity_date != null) {
    return `만기까지 ${monthsUntil(now, p.maturity_date)}개월`;
  }
  if (p.goal_amount != null && p.amount != null && p.amount > 0) {
    const left = Math.max(0, p.goal_amount - accruedAmount(p, now));
    const months = Math.ceil(left / p.amount);
    return `목표까지 약 ${months}개월`;
  }
  return null;
}

/** Deposits counted strictly within the calendar year of `now` (Jan 1 → now). */
function depositsThisYear(p: SavingsPlanRow, now: Date): number {
  const total = depositCount(p, now);
  // Subtract everything that had accrued by the end of last year.
  const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
  const priorYears = depositCount(p, endOfLastYear);
  return Math.max(0, total - priorYears);
}

function isOngoing(p: SavingsPlanRow, now: Date): boolean {
  if (!p.is_active) return false;
  if (cmpYmd(ymdFromDate(now), parseYmd(p.start_date)) < 0) return false; // not started
  if (p.maturity_date != null && cmpYmd(ymdFromDate(now), parseYmd(p.maturity_date)) > 0) {
    return false; // matured
  }
  return true;
}

/** 히어로 "이번 달 모은 돈" = sum of active, ongoing plans' monthly amount. */
export function thisMonthSaved(plans: SavingsPlanRow[], now: Date): number {
  return plans
    .filter((p) => isOngoing(p, now))
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
}

/** 히어로 "올해 모은 돈" = sum of each active plan's deposits made this year. */
export function yearSaved(plans: SavingsPlanRow[], now: Date): number {
  return plans
    .filter((p) => p.is_active)
    .reduce((sum, p) => sum + (p.amount ?? 0) * depositsThisYear(p, now), 0);
}
