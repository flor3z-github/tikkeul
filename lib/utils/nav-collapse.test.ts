import { describe, expect, it } from "vitest";

import {
  NAV_SCROLL_DELTA,
  NAV_TOP_THRESHOLD,
  nextNavScrollState,
  type NavScrollState,
} from "./nav-collapse";

const at = (collapsed: boolean, lastY: number): NavScrollState => ({
  collapsed,
  lastY,
});

describe("nextNavScrollState", () => {
  it("collapses on downward scroll past the delta threshold", () => {
    const next = nextNavScrollState(at(false, 100), 100 + NAV_SCROLL_DELTA, false);
    expect(next).toEqual({ collapsed: true, lastY: 100 + NAV_SCROLL_DELTA });
  });

  it("expands on upward scroll past the delta threshold", () => {
    const next = nextNavScrollState(at(true, 300), 300 - NAV_SCROLL_DELTA, false);
    expect(next).toEqual({ collapsed: false, lastY: 300 - NAV_SCROLL_DELTA });
  });

  it("ignores jitter below the delta threshold (state object unchanged)", () => {
    const state = at(true, 300);
    expect(nextNavScrollState(state, 300 + NAV_SCROLL_DELTA - 1, false)).toBe(state);
    expect(nextNavScrollState(state, 300 - NAV_SCROLL_DELTA + 1, false)).toBe(state);
  });

  it("always expands near the top regardless of direction", () => {
    const next = nextNavScrollState(at(true, 200), NAV_TOP_THRESHOLD - 1, false);
    expect(next.collapsed).toBe(false);
  });

  it("always expands on iOS rubber-band negative scrollY", () => {
    const next = nextNavScrollState(at(true, 10), -30, false);
    expect(next.collapsed).toBe(false);
  });

  it("clamps bottom rubber-band overshoot so lastY never exceeds maxY", () => {
    // Fast downward fling past the page end: scrollY overshoots maxY.
    const next = nextNavScrollState(at(true, 950), 1030, false, { maxY: 1000 });
    expect(next).toEqual({ collapsed: true, lastY: 1000 });
  });

  it("stays collapsed through the bottom rubber-band spring-back", () => {
    // Spring-back events (1030 → 1010 → 1000) all clamp to maxY: delta 0,
    // never mistaken for an upward user scroll.
    const state = at(true, 1000);
    expect(nextNavScrollState(state, 1010, false, { maxY: 1000 })).toBe(state);
    expect(nextNavScrollState(state, 1000, false, { maxY: 1000 })).toBe(state);
  });

  it("still expands on a real upward scroll from the very bottom", () => {
    const next = nextNavScrollState(at(true, 1000), 1000 - NAV_SCROLL_DELTA, false, {
      maxY: 1000,
    });
    expect(next).toEqual({ collapsed: false, lastY: 1000 - NAV_SCROLL_DELTA });
  });

  it("is a no-op while frozen (drawer open)", () => {
    const state = at(false, 100);
    expect(nextNavScrollState(state, 500, true)).toBe(state);
  });

  it("re-syncs lastY on the first event after unfreeze without collapsing", () => {
    // While frozen, the iOS keyboard may scroll the layout viewport far from
    // lastY. The first post-unfreeze event must re-anchor, not treat the
    // stale gap as a user scroll.
    const frozenAt = at(false, 100);
    const next = nextNavScrollState(frozenAt, 400, false, { resync: true });
    expect(next).toEqual({ collapsed: false, lastY: 400 });
  });
});
