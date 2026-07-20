// Pure reducer for the bottom nav's scroll-direction collapse. Kept free of
// DOM/React so the decision logic is unit-testable (vitest, node env).

/** Deltas below this are treated as iOS momentum/rubber-band jitter. */
export const NAV_SCROLL_DELTA = 8;
/** Within this distance from the top the nav is always expanded. */
export const NAV_TOP_THRESHOLD = 24;

export type NavScrollState = {
  collapsed: boolean;
  lastY: number;
};

type Options = {
  /** First event after an unfreeze: re-anchor lastY without judging direction. */
  resync?: boolean;
  /**
   * Max scrollable Y (scrollHeight - viewport height). iOS bottom rubber-band
   * lets scrollY overshoot past this; the spring-back then reads as an upward
   * scroll and wrongly re-expands the nav. Clamping y to [0, maxY] makes the
   * whole bounce a zero-delta no-op.
   */
  maxY?: number;
};

export function nextNavScrollState(
  state: NavScrollState,
  y: number,
  frozen: boolean,
  options: Options = {},
): NavScrollState {
  if (frozen) return state;
  const cy = Math.min(Math.max(y, 0), options.maxY ?? Infinity);
  if (cy < NAV_TOP_THRESHOLD) {
    if (!state.collapsed && state.lastY === cy) return state;
    return { collapsed: false, lastY: cy };
  }
  if (options.resync) return { collapsed: state.collapsed, lastY: cy };
  const delta = cy - state.lastY;
  if (Math.abs(delta) < NAV_SCROLL_DELTA) return state;
  return { collapsed: delta > 0, lastY: cy };
}
