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

export type ResolvedDashboardParams = {
  ym: string;
  day: string;
  monthStart: Date;
  monthEnd: Date;
};

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

export function resolveDashboardParams(
  params: { ym?: string; day?: string },
  now: Date = new Date(),
): ResolvedDashboardParams {
  const parsedYm = params.ym ? parseYearMonth(params.ym) : null;
  const monthStartDate =
    parsedYm ?? new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const ym = formatYearMonth(monthStartDate);
  const monthEndDate = new Date(
    monthStartDate.getFullYear(),
    monthStartDate.getMonth() + 1,
    1,
    0,
    0,
    0,
    0,
  );

  const isCurrentMonth =
    monthStartDate.getFullYear() === now.getFullYear() &&
    monthStartDate.getMonth() === now.getMonth();

  const fallbackDay = isCurrentMonth
    ? toISODate(now)
    : toISODate(monthStartDate);

  let day = fallbackDay;
  if (params.day) {
    const parsedDay = parseISODate(params.day);
    if (
      parsedDay &&
      parsedDay.getFullYear() === monthStartDate.getFullYear() &&
      parsedDay.getMonth() === monthStartDate.getMonth()
    ) {
      day = params.day;
    }
  }

  return {
    ym,
    day,
    monthStart: monthStartDate,
    monthEnd: monthEndDate,
  };
}
