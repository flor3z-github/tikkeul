// Pure savings-plan math for the "돈모으기" tab.
//
// The plan model is flat: name, monthly amount, deposit day, start month, an
// optional maturity date, and active/inactive. There is no stored or derived
// "모은 돈" balance/progress — goal_amount/opening_balance (and the 달성형 목표
// accrual math they powered) were removed; only the ongoing monthly flow and
// the maturity countdown remain.
//
// TZ safety: date-only inputs are 'YYYY-MM-DD' strings parsed by splitting (no
// `new Date(string)` — that would parse as UTC and drift under KST). `now` is a
// Date whose LOCAL components are read (callers pass `nowInSeoul()` so the
// components already equal the Asia/Seoul wall clock). Mirrors the holiday-set
// convention in lib/queries/holidays.ts.

export type SavingsPlanRow = {
  id: string;
  name: string;
  /** Monthly contribution. NULL = "금액 미입력" → contributes/accrues 0. */
  amount: number | null;
  /** Deposit day. NULL = unset (falls back to start_date's day), 0 = 말일, 1..31. */
  payment_day: number | null;
  /** First-deposit month, 'YYYY-MM-DD'. */
  start_date: string;
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

/** Negative if a < b, 0 if equal, positive if a > b. */
function cmpYmd(a: Ymd, b: Ymd): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

/** Whole months from `now` until the target date; 0 once reached/passed. */
function monthsUntil(now: Date, targetIso: string): number {
  const cur = ymdFromDate(now);
  const t = parseYmd(targetIso);
  let months = (t.y - cur.y) * 12 + (t.m - cur.m);
  if (t.d < cur.d) months -= 1; // the day-of-month for the final period hasn't arrived
  return Math.max(0, months);
}

/** 만기 있으면 「만기까지 N개월」, 없으면 null (달성형 목표 개념 제거). */
export function remainingLabel(p: SavingsPlanRow, now: Date): string | null {
  if (p.maturity_date != null) {
    return `만기까지 ${monthsUntil(now, p.maturity_date)}개월`;
  }
  return null;
}

/**
 * Does the plan make a real deposit on calendar date `iso` ('YYYY-MM-DD')? True
 * iff the date is on/after `start_date` and on/before `maturity_date` (open-
 * ended when maturity is null). Pure lexicographic compare on ISO date strings
 * (TZ-safe — same no-`new Date(string)` rule as the rest of this module).
 *
 * Used to bound dashboard calendar deposit markers to a plan's life so a cycle
 * before the plan started or after it matured shows no phantom marker. This is
 * exact-date — stricter than the month-based `isOngoing` the hero uses: the
 * calendar shows the actual deposit date (e.g. a plan started on the 18th with
 * payment_day=1 first deposits the NEXT month's 1st), while the hero counts the
 * start month as a current-cycle commitment. The split mirrors fixed expenses
 * (hero 고정 is current-cycle; fixed markers span cycles).
 */
export function depositsOnDate(
  p: { start_date: string; maturity_date: string | null },
  iso: string,
): boolean {
  if (iso < p.start_date) return false;
  if (p.maturity_date != null && iso > p.maturity_date) return false;
  return true;
}

function isOngoing(p: SavingsPlanRow, now: Date): boolean {
  if (!p.is_active) return false;
  if (cmpYmd(ymdFromDate(now), parseYmd(p.start_date)) < 0) return false; // not started
  if (p.maturity_date != null && cmpYmd(ymdFromDate(now), parseYmd(p.maturity_date)) > 0) {
    return false; // matured
  }
  return true;
}

/** 히어로 "매달 모으는 돈" = sum of active, ongoing plans' monthly amount. */
export function thisMonthSaved(plans: SavingsPlanRow[], now: Date): number {
  return plans
    .filter((p) => isOngoing(p, now))
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
}
