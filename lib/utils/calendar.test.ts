import { describe, expect, it } from "vitest";

import {
  addMonths,
  clampDayToMonth,
  formatKoreanLongDate,
  formatYearMonth,
  formatYearMonthKorean,
  getCycleRange,
  parseISODate,
  parseYearMonth,
  resolveDashboardParams,
  shouldShowMonthLabel,
} from "@/lib/utils/calendar";
import { toISODate } from "@/lib/utils/date";

// Fixed reference "now" so todayInCycle / fallback math is deterministic.
const NOW = new Date(2026, 5, 1, 12, 0, 0); // 2026-06-01 local

describe("parseYearMonth", () => {
  it("parses a valid YYYY-MM to the 1st of that month", () => {
    expect(toISODate(parseYearMonth("2026-05")!)).toBe("2026-05-01");
  });
  it("rejects bad month / format", () => {
    expect(parseYearMonth("2026-13")).toBeNull();
    expect(parseYearMonth("2026-00")).toBeNull();
    expect(parseYearMonth("2026-5")).toBeNull();
    expect(parseYearMonth("nope")).toBeNull();
  });
});

describe("parseISODate", () => {
  it("parses a valid YYYY-MM-DD", () => {
    expect(toISODate(parseISODate("2026-05-10")!)).toBe("2026-05-10");
  });
  it("rejects an impossible calendar date (overflow check)", () => {
    expect(parseISODate("2026-02-30")).toBeNull();
    expect(parseISODate("2026-04-31")).toBeNull();
    expect(parseISODate("2026-13-01")).toBeNull();
  });
  it("rejects bad format", () => {
    expect(parseISODate("2026-5-1")).toBeNull();
    expect(parseISODate("garbage")).toBeNull();
  });
});

describe("clampDayToMonth", () => {
  it("clamps to the month's last day", () => {
    expect(clampDayToMonth(2026, 1, 31)).toBe(28); // Feb 2026 (non-leap)
    expect(clampDayToMonth(2024, 1, 31)).toBe(29); // Feb 2024 (leap)
    expect(clampDayToMonth(2026, 3, 31)).toBe(30); // April
  });
  it("floors at 1", () => {
    expect(clampDayToMonth(2026, 4, 0)).toBe(1);
    expect(clampDayToMonth(2026, 4, -5)).toBe(1);
  });
  it("leaves an in-range day untouched", () => {
    expect(clampDayToMonth(2026, 4, 15)).toBe(15);
  });
});

describe("addMonths", () => {
  it("steps forward and back", () => {
    expect(addMonths("2026-05", 1)).toBe("2026-06");
    expect(addMonths("2026-05", -1)).toBe("2026-04");
  });
  it("crosses year boundaries", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
  it("returns input unchanged when ym is invalid", () => {
    expect(addMonths("bad", 1)).toBe("bad");
  });
});

describe("formatYearMonth", () => {
  it("zero-pads the month", () => {
    expect(formatYearMonth(new Date(2026, 0, 1))).toBe("2026-01");
    expect(formatYearMonth(new Date(2026, 11, 31))).toBe("2026-12");
  });
});

describe("formatYearMonthKorean", () => {
  it("hides the year for the current year by default", () => {
    expect(formatYearMonthKorean("2026-05", {}, NOW)).toBe("5월");
  });
  it("shows the year for a non-current year", () => {
    expect(formatYearMonthKorean("2025-05", {}, NOW)).toBe("2025년 5월");
  });
  it("always shows the year when asked", () => {
    expect(formatYearMonthKorean("2026-05", { showYear: "always" }, NOW)).toBe(
      "2026년 5월",
    );
  });
});

describe("getCycleRange — calendar mode", () => {
  it("spans the whole month, end exclusive", () => {
    const r = getCycleRange("calendar", 1, new Date(2026, 4, 10), NOW);
    expect(toISODate(r.start)).toBe("2026-05-01");
    expect(toISODate(r.end)).toBe("2026-06-01");
    expect(r.anchorYm).toBe("2026-05");
  });
  it("rolls December into the next year", () => {
    const r = getCycleRange("calendar", 1, new Date(2026, 11, 10), NOW);
    expect(toISODate(r.start)).toBe("2026-12-01");
    expect(toISODate(r.end)).toBe("2027-01-01");
  });
});

describe("getCycleRange — income_day mode", () => {
  it("anchor on/after start day → cycle begins this month", () => {
    const r = getCycleRange("income_day", 25, new Date(2026, 4, 30), NOW);
    expect(toISODate(r.start)).toBe("2026-05-25");
    expect(toISODate(r.end)).toBe("2026-06-25");
    expect(r.anchorYm).toBe("2026-05");
  });
  it("anchor before start day → cycle began last month", () => {
    const r = getCycleRange("income_day", 25, new Date(2026, 4, 10), NOW);
    expect(toISODate(r.start)).toBe("2026-04-25");
    expect(toISODate(r.end)).toBe("2026-05-25");
    expect(r.anchorYm).toBe("2026-04");
  });
  it("clamps a start day past month length (Feb, startDay=31)", () => {
    const r = getCycleRange("income_day", 31, new Date(2026, 1, 15), NOW);
    expect(toISODate(r.start)).toBe("2026-01-31");
    expect(toISODate(r.end)).toBe("2026-02-28");
  });
  it("crosses the year boundary backward", () => {
    const r = getCycleRange("income_day", 25, new Date(2026, 0, 10), NOW);
    expect(toISODate(r.start)).toBe("2025-12-25");
    expect(toISODate(r.end)).toBe("2026-01-25");
    expect(r.anchorYm).toBe("2025-12");
  });
});

describe("resolveDashboardParams", () => {
  // The push-notification deep-link regression: a friend on income_day mode
  // adds a tx dated BEFORE their cycle_start_day. The Edge function emits the
  // tx's calendar month as `ym`; the dashboard must still resolve the cycle
  // that CONTAINS the tx's `day`, keep the day, and fetch the matching window.
  it("[regression] anchors on `day` so a pre-start-day deep link resolves the right cycle", () => {
    const r = resolveDashboardParams(
      { ym: "2026-05", day: "2026-05-10" },
      { mode: "income_day", startDay: 25 },
      NOW,
    );
    expect(r.day).toBe("2026-05-10"); // kept, not dropped
    expect(toISODate(r.cycleStart)).toBe("2026-04-25"); // previous cycle
    expect(toISODate(r.cycleEnd)).toBe("2026-05-25");
    expect(r.ym).toBe("2026-04");
  });

  it("leaves a normal in-cycle day unchanged (income_day)", () => {
    const r = resolveDashboardParams(
      { ym: "2026-05", day: "2026-05-30" },
      { mode: "income_day", startDay: 25 },
      NOW,
    );
    expect(r.day).toBe("2026-05-30");
    expect(toISODate(r.cycleStart)).toBe("2026-05-25");
    expect(toISODate(r.cycleEnd)).toBe("2026-06-25");
    expect(r.ym).toBe("2026-05");
  });

  it("calendar mode is unaffected by the day-anchor change", () => {
    const r = resolveDashboardParams(
      { ym: "2026-05", day: "2026-05-10" },
      { mode: "calendar", startDay: 1 },
      NOW,
    );
    expect(r.day).toBe("2026-05-10");
    expect(toISODate(r.cycleStart)).toBe("2026-05-01");
    expect(toISODate(r.cycleEnd)).toBe("2026-06-01");
    expect(r.ym).toBe("2026-05");
  });

  it("handles a year-boundary deep link", () => {
    const r = resolveDashboardParams(
      { ym: "2026-01", day: "2026-01-10" },
      { mode: "income_day", startDay: 25 },
      NOW,
    );
    expect(r.day).toBe("2026-01-10");
    expect(toISODate(r.cycleStart)).toBe("2025-12-25");
    expect(toISODate(r.cycleEnd)).toBe("2026-01-25");
    expect(r.ym).toBe("2025-12");
  });

  it("ym-only (MonthSwitcher) still anchors on the clamped start day", () => {
    const r = resolveDashboardParams(
      { ym: "2026-05" },
      { mode: "income_day", startDay: 25 },
      NOW,
    );
    expect(toISODate(r.cycleStart)).toBe("2026-05-25");
    expect(toISODate(r.cycleEnd)).toBe("2026-06-25");
    expect(r.ym).toBe("2026-05");
    // NOW (2026-06-01) is inside the cycle → fallback day is today.
    expect(r.day).toBe("2026-06-01");
  });

  it("drops an out-of-range / malformed day, falling back within the cycle", () => {
    const r = resolveDashboardParams(
      { ym: "2026-05", day: "garbage" },
      { mode: "calendar", startDay: 1 },
      NOW,
    );
    // Falls back to cycle start (NOW is in June, not in the May cycle).
    expect(r.day).toBe("2026-05-01");
  });

  it("no params → uses `now` to pick the cycle", () => {
    const r = resolveDashboardParams({}, { mode: "calendar", startDay: 1 }, NOW);
    expect(r.ym).toBe("2026-06");
    expect(r.day).toBe("2026-06-01");
  });
});

describe("formatKoreanLongDate", () => {
  // Pattern field order is locale/ICU-dependent — assert the parts, not the
  // exact arrangement, so an ICU bump doesn't break the suite.
  it("includes month, day, and a weekday", () => {
    const out = formatKoreanLongDate(new Date(2025, 4, 9));
    expect(out).toContain("5월");
    expect(out).toContain("9일");
    expect(out).toMatch(/요일/);
  });

  it("parses a string input via parseISODate (TZ-stable)", () => {
    expect(formatKoreanLongDate("2025-05-09")).toBe(
      formatKoreanLongDate(new Date(2025, 4, 9)),
    );
  });

  it("returns empty string for invalid input", () => {
    expect(formatKoreanLongDate("garbage")).toBe("");
  });
});

describe("shouldShowMonthLabel", () => {
  // 말일 cycle 5/30–6/30 (income_day): boundaries are 5/30 (cycle start) and
  // 6/1 (month rollover). Everything else is a bare day.
  const cycleStart = "2026-05-30";

  it("labels the cycle's first day", () => {
    expect(shouldShowMonthLabel("2026-05-30", cycleStart, "income_day")).toBe(
      true,
    );
  });

  it("labels every day-1 rollover", () => {
    expect(shouldShowMonthLabel("2026-06-01", cycleStart, "income_day")).toBe(
      true,
    );
  });

  it("leaves interior days bare (e.g. 5/31, 6/2)", () => {
    expect(shouldShowMonthLabel("2026-05-31", cycleStart, "income_day")).toBe(
      false,
    );
    expect(shouldShowMonthLabel("2026-06-02", cycleStart, "income_day")).toBe(
      false,
    );
  });

  it("matches the documented 5/30·31·6/1·2·3 sequence", () => {
    const seq = [
      "2026-05-30",
      "2026-05-31",
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ];
    expect(
      seq.map((iso) => shouldShowMonthLabel(iso, cycleStart, "income_day")),
    ).toEqual([true, false, true, false, false]);
  });

  it("never labels in calendar mode, even on the 1st or the start day", () => {
    expect(shouldShowMonthLabel("2026-06-01", "2026-06-01", "calendar")).toBe(
      false,
    );
    expect(shouldShowMonthLabel("2026-06-15", "2026-06-01", "calendar")).toBe(
      false,
    );
  });

  it("handles a 그외 cycle (payday 20) where the start day is not the 1st", () => {
    // 1/20–2/20: only 1/20 (start) and 2/1 (rollover) get a label.
    const start = "2026-01-20";
    expect(shouldShowMonthLabel("2026-01-20", start, "income_day")).toBe(true);
    expect(shouldShowMonthLabel("2026-02-01", start, "income_day")).toBe(true);
    expect(shouldShowMonthLabel("2026-01-21", start, "income_day")).toBe(false);
    expect(shouldShowMonthLabel("2026-02-20", start, "income_day")).toBe(false);
  });
});
