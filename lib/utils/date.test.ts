import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatKoreanFullDate,
  formatKoreanShortDate,
  formatRelativeKoreanDate,
  monthEnd,
  monthStart,
  nowInSeoul,
  toISODate,
  todayISODate,
} from "@/lib/utils/date";

// Inputs are built with LOCAL components (new Date(y, m, d)) so assertions hold
// regardless of the process TZ. The one TZ-coupled behavior (parsing a
// UTC-instant string) gets its own block below.

describe("toISODate", () => {
  it("formats local Y-M-D zero-padded", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toISODate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("monthStart / monthEnd", () => {
  it("monthStart is the 1st at local midnight", () => {
    const s = monthStart(new Date(2026, 4, 17, 13, 30));
    expect(toISODate(s)).toBe("2026-05-01");
    expect(s.getHours()).toBe(0);
  });

  it("monthEnd is the 1st of the next month (exclusive bound)", () => {
    expect(toISODate(monthEnd(new Date(2026, 4, 17)))).toBe("2026-06-01");
    expect(toISODate(monthEnd(new Date(2026, 11, 1)))).toBe("2027-01-01");
  });
});

describe("todayISODate", () => {
  afterEach(() => vi.useRealTimers());

  it("returns today's local date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 9, 0, 0));
    expect(todayISODate()).toBe("2026-06-01");
  });
});

describe("formatRelativeKoreanDate", () => {
  afterEach(() => vi.useRealTimers());

  it("labels today/yesterday off local midnight, else short date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 23, 30, 0)); // late evening is still "today"
    expect(formatRelativeKoreanDate(new Date(2026, 5, 1))).toBe("오늘");
    expect(formatRelativeKoreanDate(new Date(2026, 4, 31))).toBe("어제");
    // Everything else (incl. future) falls through to the short formatter.
    expect(formatRelativeKoreanDate(new Date(2026, 5, 2))).toBe("6월 2일");
    expect(formatRelativeKoreanDate(new Date(2026, 4, 29))).toBe("5월 29일");
  });

  it("returns empty string for an unparseable input", () => {
    expect(formatRelativeKoreanDate("not-a-date")).toBe("");
  });
});

describe("korean date formatters", () => {
  it("short = month + day", () => {
    expect(formatKoreanShortDate(new Date(2025, 4, 9))).toBe("5월 9일");
  });

  it("full = year + month + day", () => {
    expect(formatKoreanFullDate(new Date(2025, 4, 9))).toBe("2025년 5월 9일");
  });

  it("returns empty string for invalid input", () => {
    expect(formatKoreanFullDate("garbage")).toBe("");
  });
});

describe("nowInSeoul", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns KST wall-clock components regardless of host TZ", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-31T18:00:00Z")); // = 2026-06-01 03:00 KST
    const n = nowInSeoul();
    expect(n.getFullYear()).toBe(2026);
    expect(n.getMonth()).toBe(5); // June (0-indexed)
    expect(n.getDate()).toBe(1);
    expect(n.getHours()).toBe(3);
    expect(toISODate(n)).toBe("2026-06-01");
  });

  it("maps the KST midnight boundary to the new day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-31T15:00:00Z")); // = 2026-06-01 00:00 KST
    const n = nowInSeoul();
    expect(toISODate(n)).toBe("2026-06-01");
    expect(n.getHours()).toBe(0);
  });
});

describe("timezone coupling (UTC-instant strings)", () => {
  // Transactions persist spent_at as "YYYY-MM-DDT00:00:00Z" (UTC midnight).
  // The Edge function deep-links using spent_at.slice(0,10); the client filters
  // with toISODate(new Date(spent_at)). For these to agree, the local date of a
  // UTC-midnight instant must equal the sliced date. That holds for any TZ at
  // offset >= 0 — both production surfaces qualify (server=UTC, client=KST).
  // It would BREAK west of UTC (negative offset); this test guards the assumption.
  it("UTC-midnight instant maps to the same calendar day at offset >= 0", () => {
    const offsetMinutes = -new Date(2026, 4, 10).getTimezoneOffset();
    if (offsetMinutes < 0) {
      expect(offsetMinutes).toBeLessThan(0); // west-of-UTC runner: not a prod surface
      return;
    }
    expect(toISODate(new Date("2026-05-10T00:00:00Z"))).toBe("2026-05-10");
  });
});
