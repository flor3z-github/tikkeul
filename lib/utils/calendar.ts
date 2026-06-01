import { toISODate } from "@/lib/utils/date";

const YM_RE = /^(\d{4})-(\d{2})$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DayState = "none" | "normal" | "warning" | "danger";

export type MonthCell = {
  date: Date;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
};

export type CycleMode = "calendar" | "income_day";

export type CycleSettings = {
  mode: CycleMode;
  startDay: number;
};

export type CycleRange = {
  mode: CycleMode;
  start: Date;
  end: Date;
  anchorYm: string;
  label: string;
  labelLong: string;
};

export type CycleMatrixCell =
  | { kind: "day"; date: Date; iso: string; isToday: boolean }
  | { kind: "empty" };

export type ResolvedDashboardParams = {
  ym: string;
  day: string;
  cycleStart: Date;
  cycleEnd: Date;
  cycleMode: CycleMode;
  cycleLabel: string;
  cycleLabelLong: string;
};

export const DEFAULT_CYCLE: CycleSettings = { mode: "calendar", startDay: 1 };

// Payday picker options shown in Settings. '1'..'28' map to a real day-of-month;
// 'last' is the end-of-month case (말일). 29/30/31 are intentionally NOT offered:
// a true month-end payer picks 'last' (stored as payday 0), keeping the picker
// values aligned to the user_settings.payday smallint domain (0=말일, 1..28).
//
// These map to the Model B user_settings.payday column (0=말일, 1..28) via
// paydayCodeToDb / dbToPaydayCode — NOT to cycle_mode/cycle_start_day. The
// cycle is computed from payday + payroll_rule + public holidays in
// lib/utils/payday-cycle.ts (getCycleRangeB / resolveDashboardParamsB).
export type PaydayCode = string; // "1".."28" | "last"
export const PAYDAY_OPTIONS: { value: PaydayCode; label: string }[] = [
  ...Array.from({ length: 28 }, (_, i) => {
    const day = i + 1;
    return { value: String(day), label: `${day}일` };
  }),
  { value: "last", label: "말일 (매월 마지막 날)" },
];

// Payday picker value -> user_settings.payday smallint (Model B):
// 'last' -> 0 (말일, shares payment-day.ts PAYMENT_DAY_END_OF_MONTH=0), else the
// literal day 1..28. Replaces the old paydayToCycle calendar/income_day mapping.
export function paydayCodeToDb(code: PaydayCode): number {
  return code === "last" ? 0 : Number(code);
}

// Inverse of paydayCodeToDb, for the Select's initial value: 0 -> 'last', else
// the day string. Replaces the old cycleToPayday mapping. Note: after the M2
// backfill, legacy 말일 payers that were stored under calendar mode surface as
// payday=1 -> '1일' (lossy, documented); they must re-select 말일 in Settings.
export function dbToPaydayCode(payday: number): PaydayCode {
  return payday === 0 ? "last" : String(payday);
}

export function parseYearMonth(ym: string): Date | null {
  const m = YM_RE.exec(ym);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

export function parseISODate(value: string): Date | null {
  const m = DAY_RE.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

export function formatYearMonth(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export function addMonths(ym: string, delta: number): string {
  const base = parseYearMonth(ym);
  if (!base) return ym;
  const next = new Date(
    base.getFullYear(),
    base.getMonth() + delta,
    1,
    0,
    0,
    0,
    0,
  );
  return formatYearMonth(next);
}

type FormatYearMonthOptions = { showYear?: "auto" | "always" | "never" };

export function formatYearMonthKorean(
  ym: string,
  options: FormatYearMonthOptions = {},
  now: Date = new Date(),
): string {
  const base = parseYearMonth(ym);
  if (!base) return "";
  const showYear = options.showYear ?? "auto";
  const includeYear =
    showYear === "always" ||
    (showYear === "auto" && base.getFullYear() !== now.getFullYear());
  return includeYear
    ? `${base.getFullYear()}년 ${base.getMonth() + 1}월`
    : `${base.getMonth() + 1}월`;
}

const koreanLongDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

export function formatKoreanLongDate(input: string | Date): string {
  const date = typeof input === "string" ? parseISODate(input) : input;
  if (!date || Number.isNaN(date.getTime())) return "";
  return koreanLongDateFormatter.format(date);
}

export function buildMonthMatrix(
  ym: string,
  now: Date = new Date(),
): MonthCell[] {
  const base = parseYearMonth(ym);
  if (!base) return [];
  const firstDayOfWeek = base.getDay(); // 0 = Sun
  const start = new Date(
    base.getFullYear(),
    base.getMonth(),
    1 - firstDayOfWeek,
    0,
    0,
    0,
    0,
  );
  const todayIso = toISODate(now);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + i,
      0,
      0,
      0,
      0,
    );
    const iso = toISODate(date);
    cells.push({
      date,
      iso,
      inMonth:
        date.getMonth() === base.getMonth() &&
        date.getFullYear() === base.getFullYear(),
      isToday: iso === todayIso,
    });
  }
  return cells;
}

// Clamps a day-of-month to the actual last day of (year, monthIndex).
// E.g. clampDayToMonth(2026, 1 /* Feb */, 31) === 28.
export function clampDayToMonth(
  year: number,
  monthIndex: number,
  day: number,
): number {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(1, day), lastDay);
}

/**
 * @deprecated Model B replaced this with
 * lib/utils/payday-cycle.ts::getCycleRangeB (payday + payroll_rule + holidays).
 * Kept (deprecate-preserve) as a rollback surface; has no callers once all
 * Model B consumer edits land.
 *
 * Computes the cycle range (start inclusive, end exclusive) that contains
 * `anchor`. For calendar mode this is the calendar month of `anchor`. For
 * income_day mode this is [N of month, N of next month) with short-month
 * clamping on both ends.
 */
export function getCycleRange(
  mode: CycleMode,
  startDay: number,
  anchor: Date,
  now: Date = new Date(),
): CycleRange {
  if (mode === "calendar") {
    const start = new Date(
      anchor.getFullYear(),
      anchor.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
    const end = new Date(
      anchor.getFullYear(),
      anchor.getMonth() + 1,
      1,
      0,
      0,
      0,
      0,
    );
    return {
      mode,
      start,
      end,
      anchorYm: formatYearMonth(start),
      label: formatYearMonthKorean(formatYearMonth(start), {}, now),
      labelLong: formatYearMonthKorean(
        formatYearMonth(start),
        { showYear: "always" },
        now,
      ),
    };
  }

  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  let startY: number;
  let startM: number;
  let endY: number;
  let endM: number;
  if (d >= Math.min(startDay, clampDayToMonth(y, m, startDay))) {
    startY = y;
    startM = m;
    endY = m === 11 ? y + 1 : y;
    endM = m === 11 ? 0 : m + 1;
  } else {
    startY = m === 0 ? y - 1 : y;
    startM = m === 0 ? 11 : m - 1;
    endY = y;
    endM = m;
  }
  const start = new Date(
    startY,
    startM,
    clampDayToMonth(startY, startM, startDay),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    endY,
    endM,
    clampDayToMonth(endY, endM, startDay),
    0,
    0,
    0,
    0,
  );
  return {
    mode,
    start,
    end,
    anchorYm: formatYearMonth(start),
    label: formatCycleLabel(start, end, now),
    labelLong: formatCycleLabelLong(start, end),
  };
}

// "5/20 – 6/19" when same year as `now`, otherwise "2026/12/15 – 2027/1/14".
// `end` is exclusive, so display uses end-1 day.
export function formatCycleLabel(
  start: Date,
  end: Date,
  now: Date = new Date(),
): string {
  const lastDay = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() - 1,
    0,
    0,
    0,
    0,
  );
  const sameYear =
    start.getFullYear() === lastDay.getFullYear() &&
    start.getFullYear() === now.getFullYear();
  if (sameYear) {
    return `${start.getMonth() + 1}/${start.getDate()} – ${lastDay.getMonth() + 1}/${lastDay.getDate()}`;
  }
  return `${start.getFullYear()}/${start.getMonth() + 1}/${start.getDate()} – ${lastDay.getFullYear()}/${lastDay.getMonth() + 1}/${lastDay.getDate()}`;
}

// "5월 20일 – 6월 19일" (used in settings preview, dashboard subtitles).
export function formatCycleLabelLong(start: Date, end: Date): string {
  const lastDay = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() - 1,
    0,
    0,
    0,
    0,
  );
  return `${start.getMonth() + 1}월 ${start.getDate()}일 – ${lastDay.getMonth() + 1}월 ${lastDay.getDate()}일`;
}

// Variable-row matrix that renders only the cycle's days. Lead/tail are
// padded with `empty` cells so rows stay 7 wide.
export function buildCycleMatrix(
  cycleStart: Date,
  cycleEnd: Date,
  now: Date = new Date(),
): CycleMatrixCell[] {
  const cells: CycleMatrixCell[] = [];
  const leadEmpty = cycleStart.getDay();
  for (let i = 0; i < leadEmpty; i++) cells.push({ kind: "empty" });

  const todayIso = toISODate(now);
  const cursor = new Date(
    cycleStart.getFullYear(),
    cycleStart.getMonth(),
    cycleStart.getDate(),
    0,
    0,
    0,
    0,
  );
  // cycleEnd may have crossed an RSC boundary from a server in a different
  // timezone (UTC on Vercel) into a client in KST, so its raw timestamp can
  // disagree with `cursor` (always built in the client's local tz) by the
  // tz offset. Rebuild the upper bound from the local-tz Y/M/D so the
  // comparison stays in a single tz.
  const endLocal = new Date(
    cycleEnd.getFullYear(),
    cycleEnd.getMonth(),
    cycleEnd.getDate(),
    0,
    0,
    0,
    0,
  );
  while (cursor.getTime() < endLocal.getTime()) {
    const iso = toISODate(cursor);
    cells.push({
      kind: "day",
      date: new Date(cursor.getTime()),
      iso,
      isToday: iso === todayIso,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  while (cells.length % 7 !== 0) cells.push({ kind: "empty" });
  return cells;
}

// `available / 30` baseline keeps the threshold predictable month-to-month and
// avoids month-length skew (28 vs 31). 2× → warning, 3× → danger.
export function classifyDailyAmount(
  amount: number,
  availableBudget: number,
): DayState {
  if (amount <= 0) return "none";
  if (availableBudget <= 0) return "normal";
  const daily = availableBudget / 30;
  if (amount >= daily * 3) return "danger";
  if (amount >= daily * 2) return "warning";
  return "normal";
}

/**
 * @deprecated Model B replaced this with
 * lib/utils/payday-cycle.ts::resolveDashboardParamsB (payday + payroll_rule +
 * holidays). Kept (deprecate-preserve) as a rollback surface; has no callers
 * once all Model B consumer edits land.
 */
export function resolveDashboardParams(
  params: { ym?: string; day?: string },
  cycle: CycleSettings = DEFAULT_CYCLE,
  now: Date = new Date(),
): ResolvedDashboardParams {
  const parsedYm = params.ym ? parseYearMonth(params.ym) : null;
  const parsedDay = params.day ? parseISODate(params.day) : null;
  // A deep link (push notification) carries `day` as the source of truth for
  // which transaction to surface. In income_day mode the Edge function emits a
  // calendar-month `ym` (spent_at.slice(0,7)) that can resolve to a cycle which
  // does NOT contain that day: a tx dated before cycle_start_day belongs to the
  // *previous* income-day cycle. Anchoring on `ym` would then drop the day
  // override below AND fetch the wrong cycle window, so the notification lands
  // on a day with no matching row ("해당 소비내역을 찾을 수 없어요"). Anchor on
  // the day itself whenever one is present so the resolved cycle always
  // contains it (when the day already falls inside the ym-cycle this yields the
  // identical range, so normal navigation is unaffected).
  //
  // For income_day with only `?ym=YYYY-MM` (MonthSwitcher), treat it as "the
  // cycle whose start lives in that month": anchor on the (clamped) start-day so
  // `addMonths(ym, ±1)` round-trips deterministically.
  const anchor =
    parsedDay != null
      ? parsedDay
      : parsedYm == null
        ? now
        : cycle.mode === "income_day"
          ? new Date(
              parsedYm.getFullYear(),
              parsedYm.getMonth(),
              clampDayToMonth(
                parsedYm.getFullYear(),
                parsedYm.getMonth(),
                cycle.startDay,
              ),
              0,
              0,
              0,
              0,
            )
          : parsedYm;
  const range = getCycleRange(cycle.mode, cycle.startDay, anchor, now);

  const todayInCycle =
    now.getTime() >= range.start.getTime() &&
    now.getTime() < range.end.getTime();
  const fallbackDay = todayInCycle ? toISODate(now) : toISODate(range.start);

  let day = fallbackDay;
  if (
    params.day &&
    parsedDay &&
    parsedDay.getTime() >= range.start.getTime() &&
    parsedDay.getTime() < range.end.getTime()
  ) {
    day = params.day;
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
