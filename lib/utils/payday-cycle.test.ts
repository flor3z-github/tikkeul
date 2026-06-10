import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPreviousCycleB,
  resolveDashboardParamsB,
} from "@/lib/utils/payday-cycle";
import { nowInSeoul, toISODate } from "@/lib/utils/date";

// Fixed reference "now" so todayInCycle / fallback math is deterministic.
const NOW = new Date(2026, 5, 1, 12, 0, 0); // 2026-06-01 local
// rule="same" + no holidays isolates the day-anchor logic from business-day
// adjustment: the deposit/anchor lands on the nominal day exactly, so cycle
// boundaries are predictable (payday=25 → [25th, 25th-of-next)).
const NONE: Set<string> = new Set();

describe("resolveDashboardParamsB — day-anchor deep link", () => {
  // The Model B port of the resolveDashboardParams push-notification fix:
  // notify-friend-spending emits the tx's CALENDAR month as `ym`
  // (spent_at.slice(0,7)) + the exact `day`. A payday=25 friend adds a tx dated
  // 2026-05-10 (BEFORE the 25th), so it belongs to the [04-25, 05-25) cycle, but
  // the deep link's ym is "2026-05". Anchoring on ym resolves [05-25, 06-25) —
  // which does NOT contain the day → the row is lost. The fix anchors on `day`.
  it("[regression] anchors on `day` so a pre-payday deep link resolves the right cycle", () => {
    const r = resolveDashboardParamsB(
      { ym: "2026-05", day: "2026-05-10" },
      25,
      "same",
      NONE,
      NOW,
    );
    expect(r.day).toBe("2026-05-10"); // kept, not dropped
    expect(toISODate(r.cycleStart)).toBe("2026-04-25"); // previous cycle
    expect(toISODate(r.cycleEnd)).toBe("2026-05-25");
    expect(r.ym).toBe("2026-04");
  });

  it("leaves a normal in-cycle day unchanged", () => {
    const r = resolveDashboardParamsB(
      { ym: "2026-05", day: "2026-05-30" },
      25,
      "same",
      NONE,
      NOW,
    );
    expect(r.day).toBe("2026-05-30");
    expect(toISODate(r.cycleStart)).toBe("2026-05-25");
    expect(toISODate(r.cycleEnd)).toBe("2026-06-25");
    expect(r.ym).toBe("2026-05");
  });

  it("payday=1 (calendar-aligned) is unaffected by the day-anchor change", () => {
    const r = resolveDashboardParamsB(
      { ym: "2026-05", day: "2026-05-10" },
      1,
      "same",
      NONE,
      NOW,
    );
    expect(r.day).toBe("2026-05-10");
    expect(toISODate(r.cycleStart)).toBe("2026-05-01");
    expect(toISODate(r.cycleEnd)).toBe("2026-06-01");
    expect(r.ym).toBe("2026-05");
    expect(r.cycleMode).toBe("calendar");
  });

  it("handles a year-boundary deep link", () => {
    const r = resolveDashboardParamsB(
      { ym: "2026-01", day: "2026-01-10" },
      25,
      "same",
      NONE,
      NOW,
    );
    expect(r.day).toBe("2026-01-10");
    expect(toISODate(r.cycleStart)).toBe("2025-12-25");
    expect(toISODate(r.cycleEnd)).toBe("2026-01-25");
    expect(r.ym).toBe("2025-12");
  });

  it("drops a malformed day, falling back within the ym-cycle", () => {
    const r = resolveDashboardParamsB(
      { ym: "2026-05", day: "garbage" },
      25,
      "same",
      NONE,
      NOW,
    );
    // parsedDay is null → ym path; NOW (06-01) is inside [05-25, 06-25).
    expect(r.day).toBe("2026-06-01");
    expect(toISODate(r.cycleStart)).toBe("2026-05-25");
    expect(r.ym).toBe("2026-05");
  });
});

describe("resolveDashboardParamsB — ym-only navigation (MonthSwitcher)", () => {
  it("ym-only resolves the cycle whose nominal month is that label", () => {
    const r = resolveDashboardParamsB({ ym: "2026-05" }, 25, "same", NONE, NOW);
    expect(toISODate(r.cycleStart)).toBe("2026-05-25");
    expect(toISODate(r.cycleEnd)).toBe("2026-06-25");
    expect(r.ym).toBe("2026-05");
    // NOW (2026-06-01) is inside the cycle → fallback day is today.
    expect(r.day).toBe("2026-06-01");
  });

  it("말일 (payday=0) label round-trips through the +1-month offset", () => {
    // 말일 deposit of Jan labels as 「2월」 (labelMonthIndex=+1). Stepping the
    // switcher to "2026-02" must resolve the Jan-nominal cycle, NOT Feb's.
    const r = resolveDashboardParamsB({ ym: "2026-02" }, 0, "same", NONE, NOW);
    expect(toISODate(r.cycleStart)).toBe("2026-01-31");
    expect(toISODate(r.cycleEnd)).toBe("2026-02-28");
    expect(r.ym).toBe("2026-02"); // round-trips back to the input label
  });

  it("no params → uses `now` to pick the containing cycle", () => {
    const r = resolveDashboardParamsB({}, 25, "same", NONE, NOW);
    // findContainingCycle(now=06-01) → [05-25, 06-25), labelled 2026-05.
    expect(toISODate(r.cycleStart)).toBe("2026-05-25");
    expect(r.ym).toBe("2026-05");
    expect(r.day).toBe("2026-06-01");
  });
});

describe("resolveDashboardParamsB — UTC-host cycle resolution (nowInSeoul)", () => {
  // Production regression pin for the Vercel-UTC 00:00-09:00 KST bug. The RSC
  // call sites now pass `nowInSeoul()` as `now` instead of relying on the
  // engine's `new Date()` default. Under TZ=UTC (the `pnpm test:utc` runner =
  // production's actual timezone), `new Date()` would yield 2026-05-31 wall
  // components at this instant → the May cycle. `nowInSeoul()` instead yields
  // the KST wall clock (2026-06-01 03:00) → the June cycle. So WITHOUT the fix
  // this test resolves May under TZ=UTC; WITH it, June on both TZ=UTC and KST.
  afterEach(() => {
    vi.useRealTimers();
  });

  it("[regression] empty params + nowInSeoul resolves the June cycle (not the prior May cycle) on a UTC host", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-31T18:00:00Z")); // = 2026-06-01 03:00 KST
    const r = resolveDashboardParamsB({}, 1, "same", NONE, nowInSeoul());
    // payday=1/"same"/no holidays → cycle is exactly [1st, 1st-of-next).
    expect(toISODate(r.cycleStart)).toBe("2026-06-01");
    expect(toISODate(r.cycleEnd)).toBe("2026-07-01");
    expect(r.ym).toBe("2026-06");
    expect(r.day).toBe("2026-06-01");
    // Explicitly NOT the previous (May) cycle — what `new Date()` would yield
    // under TZ=UTC at this instant.
    expect(toISODate(r.cycleStart)).not.toBe("2026-05-01");
    expect(r.day).not.toBe("2026-05-31");
  });
});

describe("getPreviousCycleB — 전월比 anchor (/stats)", () => {
  it("previous cycle's end equals the current cycle's start (contiguous) across paydays/rules", () => {
    for (const payday of [1, 15, 25, 0]) {
      for (const rule of ["prev", "same", "next"] as const) {
        const cur = resolveDashboardParamsB(
          { ym: "2026-05" },
          payday,
          rule,
          NONE,
          NOW,
        );
        const prev = getPreviousCycleB(payday, rule, NONE, cur.cycleStart);
        expect(prev.end.getTime()).toBe(cur.cycleStart.getTime());
        expect(prev.start.getTime()).toBeLessThan(prev.end.getTime());
      }
    }
  });

  it("payday=25 same: previous of [05-25, 06-25) is [04-25, 05-25)", () => {
    const cur = resolveDashboardParamsB({ ym: "2026-05" }, 25, "same", NONE, NOW);
    const prev = getPreviousCycleB(25, "same", NONE, cur.cycleStart);
    expect(toISODate(prev.start)).toBe("2026-04-25");
    expect(toISODate(prev.end)).toBe("2026-05-25");
    expect(prev.anchorYm).toBe("2026-04");
  });

  it("year boundary — payday=1 same: previous of the Jan 2026 cycle is Dec 2025", () => {
    const cur = resolveDashboardParamsB({ ym: "2026-01" }, 1, "same", NONE, NOW);
    expect(toISODate(cur.cycleStart)).toBe("2026-01-01");
    const prev = getPreviousCycleB(1, "same", NONE, cur.cycleStart);
    expect(toISODate(prev.start)).toBe("2025-12-01");
    expect(toISODate(prev.end)).toBe("2026-01-01");
    expect(prev.anchorYm).toBe("2025-12");
  });
});
