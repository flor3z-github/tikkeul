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
};

export function nextNavScrollState(
  state: NavScrollState,
  y: number,
  frozen: boolean,
  options: Options = {},
): NavScrollState {
  if (frozen) return state;
  if (y < NAV_TOP_THRESHOLD) {
    if (!state.collapsed && state.lastY === y) return state;
    return { collapsed: false, lastY: y };
  }
  if (options.resync) return { collapsed: state.collapsed, lastY: y };
  const delta = y - state.lastY;
  if (Math.abs(delta) < NAV_SCROLL_DELTA) return state;
  return { collapsed: delta > 0, lastY: y };
}
