// Model B budget-cycle engine — paycheck-deposit-anchored, holiday + weekend
// (payroll-rule) adjusted. Pure functions only: NO Supabase imports. Holidays
// are injected as a Set<string> of 'YYYY-MM-DD' strings (see
// lib/queries/holidays.ts::getHolidays).
//
// All Date construction goes through `new Date(y, monthIndex, d, 0,0,0,0)`
// (local tz, midnight) so DST/UTC never shifts a day. We key holiday lookups on
// `toISODate(date)`, which is also local-tz, keeping the comparison consistent.

import {
  type CycleMode,
  type CycleRange,
  type ResolvedDashboardParams,
  clampDayToMonth,
  formatCycleLabel,
  formatCycleLabelLong,
  formatYearMonth,
  formatYearMonthKorean,
  parseISODate,
  parseYearMonth,
} from "@/lib/utils/calendar";
import { toISODate } from "@/lib/utils/date";

export type PayrollRule = "prev" | "same" | "next";

// 0 = 말일 (end of month). Shares the payment-day.ts convention
// (PAYMENT_DAY_END_OF_MONTH = 0); 1..28 are literal days-of-month. This is the
// user_settings.payday value, the Model B deposit anchor.
export const PAYDAY_END_OF_MONTH = 0;

// Defensive cap on the business-day walk. A month fully blocked by weekends +
// holidays is impossible with real data, but never risk an infinite loop.
const MAX_BUSINESS_DAY_STEPS = 31;

function localMidnight(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

function cloneMidnight(date: Date): Date {
  return localMidnight(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isHoliday(date: Date, holidays: Set<string>): boolean {
  return holidays.has(toISODate(date));
}

export function isBusinessDay(date: Date, holidays: Set<string>): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Sun / Sat
  return !isHoliday(date, holidays);
}

/**
 * Adjusts a (nominal) date to a business day per the payroll rule.
 *  - 'same': return the date unchanged (Model B permits a non-business deposit
 *    date — the user is paid on the nominal day regardless).
 *  - 'prev': walk backward day-by-day to the nearest prior business day.
 *  - 'next': walk forward to the nearest following business day.
 * Walks may cross month/year boundaries — that is intended.
 */
export function adjustToBusinessDay(
  date: Date,
  rule: PayrollRule,
  holidays: Set<string>,
): Date {
  const cursor = cloneMidnight(date);
  if (rule === "same") return cursor;

  const step = rule === "prev" ? -1 : 1;
  for (let i = 0; i < MAX_BUSINESS_DAY_STEPS; i++) {
    if (isBusinessDay(cursor, holidays)) return cursor;
    cursor.setDate(cursor.getDate() + step);
  }
  return cursor; // defensive: unreachable with real holiday data
}

/**
 * Predicted paycheck deposit date for (year, monthIndex). The nominal date is
 * the last day of the month for 말일 (payday 0), else the literal day (clamped
 * defensively — payday is always 1..28 so the clamp never fires). The nominal
 * date is then business-day-adjusted by the payroll rule.
 */
export function resolveDeposit(
  year: number,
  monthIndex: number,
  payday: number,
  rule: PayrollRule,
  holidays: Set<string>,
): Date {
  const nominal =
    payday === PAYDAY_END_OF_MONTH
      ? localMidnight(year, monthIndex + 1, 0) // last day of (year, monthIndex)
      : localMidnight(year, monthIndex, clampDayToMonth(year, monthIndex, payday));
  return adjustToBusinessDay(nominal, rule, holidays);
}

/**
 * Cycle anchor (start marker) for the deposit of (year, monthIndex). The anchor
 * is the deposit day ITSELF for every payday, 말일 included — the budget cycle is
 * [payday, next payday), so the day money arrives is day 1 of the cycle that
 * paycheck funds, and a payday spend lands in the new cycle (not the prior one).
 * (Previously 말일 anchored on deposit+1 to snap the cycle onto the calendar last
 * day; that pushed the deposit day OUT of the cycle its paycheck funds — removed.)
 * e.g. 2026 Jan 말일, prev → deposit 1/30 (Fri) = anchor 1/30.
 */
export function resolveAnchor(
  year: number,
  monthIndex: number,
  payday: number,
  rule: PayrollRule,
  holidays: Set<string>,
): Date {
  return resolveDeposit(year, monthIndex, payday, rule, holidays);
}

/**
 * Months to ADD to the nominal/deposit month to get the displayed LABEL month:
 * 말일 → +1 (next month), else +0. Single source for the 말일 +1-month label
 * rule, used by getCycleRangeB (label derivation) and resolveDashboardParamsB
 * (label↔nominal conversion for navigation round-trips).
 */
export function labelMonthIndex(payday: number): number {
  return payday === PAYDAY_END_OF_MONTH ? 1 : 0;
}

/**
 * Builds the cycle range for the NOMINAL (deposit) month identified by
 * `anchorMonth`'s (year, monthIndex). NOTE: `anchorMonth` is the nominal month,
 * NOT the label month — navigation converts label→nominal before calling this
 * (see resolveDashboardParamsB).
 *
 *   start = resolveAnchor(M)
 *   end   = resolveAnchor(M + 1)   // exclusive; Dec→Jan rollover handled
 *
 * cycleMode is DERIVED for downstream consumers (grid / copy switch on it
 * unchanged): 'calendar' iff start is the 1st of its month AND end is the 1st
 * of the immediately following month (exactly one calendar month apart);
 * otherwise 'income_day'. A payday=1 cycle that lands on [1st, 1st-of-next)
 * reads as calendar; any shifted/말일 cycle reads as income_day.
 *
 * Returns the EXACT existing CycleRange shape so every current consumer is
 * untouched.
 *
 * Verified 2026 (rule=prev):
 *   payday=1, Jan  → [2025-12-31, 2026-01-30) label '1월' (Feb nominal 2/1=Sun
 *                    → prev → 1/30; Jan nominal 1/1 신정 → prev → 2025-12-31)
 *   payday=20, Jan → [2026-01-20, 2026-02-20) label '1/20 – 2/19' (both biz days)
 *   payday=0(말일), Jan → [2026-01-30, 2026-02-27) label '2월'
 *                    (Jan deposit 1/31 Sat → prev → 1/30 = anchor;
 *                     Feb deposit 2/28 Sat → prev → 2/27 = anchor)
 */
export function getCycleRangeB(
  payday: number,
  rule: PayrollRule,
  holidays: Set<string>,
  anchorMonth: Date,
  now: Date = new Date(),
): CycleRange {
  const mYear = anchorMonth.getFullYear();
  const mIndex = anchorMonth.getMonth();
  const nextYear = mIndex === 11 ? mYear + 1 : mYear;
  const nextIndex = mIndex === 11 ? 0 : mIndex + 1;

  const start = resolveAnchor(mYear, mIndex, payday, rule, holidays);
  const end = resolveAnchor(nextYear, nextIndex, payday, rule, holidays);

  // mode drives the GRID only (calendar 7x6 vs variable cycle matrix): 'calendar'
  // iff the cycle is exactly one calendar month [1st, 1st-of-next). A shifted
  // payday=1 cycle (e.g. 12/31–1/30) is 'income_day', so its grid correctly
  // renders the real cycle days starting on the 31st.
  const startMonthOrdinal = start.getFullYear() * 12 + start.getMonth();
  const endMonthOrdinal = end.getFullYear() * 12 + end.getMonth();
  const mode: CycleMode =
    start.getDate() === 1 &&
    end.getDate() === 1 &&
    endMonthOrdinal - startMonthOrdinal === 1
      ? "calendar"
      : "income_day";

  // Label month = nominal month + labelMonthIndex(payday). Derived from the
  // nominal month M (not from `start`) so it round-trips with navigation.
  const labelDate = localMidnight(mYear, mIndex + labelMonthIndex(payday), 1);
  const anchorYm = formatYearMonth(labelDate);

  // LABEL is decoupled from `mode` and chosen by PAYDAY (the user's original
  // spec): 1일 / 말일 anchor a whole paycheck-month, so they read as the clean
  // 「N월」 (말일 → next month via labelMonthIndex) EVEN when the cycle is shifted
  // off the calendar month (e.g. 12/31–1/30 still shows 「1월」 while its grid
  // starts on the 31st). 2~28 read as the explicit "M/D – M/D" range.
  const usesMonthLabel =
    payday === PAYDAY_END_OF_MONTH || payday === 1;
  const label = usesMonthLabel
    ? formatYearMonthKorean(anchorYm, {}, now)
    : formatCycleLabel(start, end, now);
  const labelLong = usesMonthLabel
    ? formatYearMonthKorean(anchorYm, { showYear: "always" }, now)
    : formatCycleLabelLong(start, end);

  return { mode, start, end, anchorYm, label, labelLong };
}

/**
 * Finds the cycle [start, end) that CONTAINS `now`. Cycles are contiguous
 * (end(M) === start(M+1)) and monotonic, so we anchor on `now`'s nominal month
 * and walk one nominal month at a time toward the bracketing cycle. A fixed
 * ±1-month probe is NOT enough: under 'prev' a payday=1 cycle starts in the
 * PRIOR month (so late-M dates belong to M+1's cycle), and under 'next' a 말일
 * cycle anchors ~1st of the FOLLOWING month (so early-M dates fall two nominal
 * months back). The directional walk is correct for every payday × rule.
 * Bounded well above any real displacement; converges in ≤2 steps in practice.
 */
function findContainingCycle(
  payday: number,
  rule: PayrollRule,
  holidays: Set<string>,
  now: Date,
): CycleRange {
  const nowTime = localMidnight(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  let probe = localMidnight(now.getFullYear(), now.getMonth(), 1);
  let range = getCycleRangeB(payday, rule, holidays, probe, now);

  // now before this cycle → walk the nominal month backward.
  for (let i = 0; i < 4 && nowTime < range.start.getTime(); i++) {
    probe = localMidnight(probe.getFullYear(), probe.getMonth() - 1, 1);
    range = getCycleRangeB(payday, rule, holidays, probe, now);
  }
  // now at/after this cycle's end → walk the nominal month forward.
  for (let i = 0; i < 4 && nowTime >= range.end.getTime(); i++) {
    probe = localMidnight(probe.getFullYear(), probe.getMonth() + 1, 1);
    range = getCycleRangeB(payday, rule, holidays, probe, now);
  }
  return range;
}

/**
 * The cycle currently CONTAINING `now`. Exposed for surfaces that need the
 * active window without a ?ym (settings income-adjustment drawer + settings
 * cycle preview). Unlike getCycleRangeB — whose 4th arg is the NOMINAL month,
 * not a containing-date lookup — this always brackets `now`.
 */
export function getCurrentCycleB(
  payday: number,
  rule: PayrollRule,
  holidays: Set<string>,
  now: Date = new Date(),
): CycleRange {
  return findContainingCycle(payday, rule, holidays, now);
}

// LABEL month string for the cycle containing `now` — used by
// resolveDashboardParamsB when ?ym is absent.
function currentLabelYm(
  payday: number,
  rule: PayrollRule,
  holidays: Set<string>,
  now: Date,
): string {
  return findContainingCycle(payday, rule, holidays, now).anchorYm;
}

/**
 * Model B replacement for resolveDashboardParams.
 *
 * `params.ym` is the LABEL month (what MonthSwitcher steps via
 * addMonths(ym, ±1)). We:
 *   1. Resolve the LABEL month (from ?ym, or the cycle currently containing
 *      `now`).
 *   2. Convert LABEL → NOMINAL month by subtracting labelMonthIndex(payday).
 *   3. getCycleRangeB(nominal) → its anchorYm === the original label, so the
 *      navigation round-trip is exact even for 말일 (+1-month label).
 *   4. Validate ?day within [start, end) with a today-in-cycle fallback
 *      (identical logic to the legacy resolveDashboardParams).
 */
export function resolveDashboardParamsB(
  params: { ym?: string; day?: string },
  payday: number,
  rule: PayrollRule,
  holidays: Set<string>,
  now: Date = new Date(),
): ResolvedDashboardParams {
  const parsedYm = params.ym ? parseYearMonth(params.ym) : null;
  const labelYm =
    parsedYm == null
      ? currentLabelYm(payday, rule, holidays, now)
      : formatYearMonth(parsedYm);

  const labelDate = parseYearMonth(labelYm) ?? now;
  // LABEL → NOMINAL: subtract the 말일 +1-month offset.
  const nominalDate = localMidnight(
    labelDate.getFullYear(),
    labelDate.getMonth() - labelMonthIndex(payday),
    1,
  );

  const range = getCycleRangeB(payday, rule, holidays, nominalDate, now);

  const todayInCycle =
    now.getTime() >= range.start.getTime() &&
    now.getTime() < range.end.getTime();
  const fallbackDay = todayInCycle ? toISODate(now) : toISODate(range.start);

  let day = fallbackDay;
  if (params.day) {
    const parsedDay = parseISODate(params.day);
    if (
      parsedDay &&
      parsedDay.getTime() >= range.start.getTime() &&
      parsedDay.getTime() < range.end.getTime()
    ) {
      day = params.day;
    }
  }

  return {
    ym: range.anchorYm,
    day,
    cycleStart: range.start,
    cycleEnd: range.end,
    cycleMode: range.mode,
    cycleLabel: range.label,
    cycleLabelLong: range.labelLong,
  };
}
