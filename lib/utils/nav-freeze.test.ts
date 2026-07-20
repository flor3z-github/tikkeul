import { describe, expect, it, vi } from "vitest";

import { createNavFreeze } from "./nav-freeze";

describe("createNavFreeze", () => {
  it("starts unfrozen", () => {
    const freeze = createNavFreeze(() => {});
    expect(freeze.frozen).toBe(false);
  });

  it("freezes on first acquire and calls apply(true) once", () => {
    const apply = vi.fn();
    const freeze = createNavFreeze(apply);
    freeze.acquire();
    expect(freeze.frozen).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(true);
  });

  it("stays frozen while nested acquires remain (drawer-in-drawer)", () => {
    const apply = vi.fn();
    const freeze = createNavFreeze(apply);
    freeze.acquire(); // outer drawer
    freeze.acquire(); // nested drawer (e.g. category picker)
    freeze.release(); // nested closes
    expect(freeze.frozen).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1); // only the 0→1 edge
  });

  it("unfreezes only when count returns to zero", () => {
    const apply = vi.fn();
    const freeze = createNavFreeze(apply);
    freeze.acquire();
    freeze.acquire();
    freeze.release();
    freeze.release();
    expect(freeze.frozen).toBe(false);
    expect(apply).toHaveBeenLastCalledWith(false);
    expect(apply).toHaveBeenCalledTimes(2); // true then false
  });

  it("clamps release below zero (unbalanced release is a no-op)", () => {
    const apply = vi.fn();
    const freeze = createNavFreeze(apply);
    freeze.release();
    expect(freeze.frozen).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    freeze.acquire();
    expect(freeze.frozen).toBe(true); // counter didn't go negative
  });
});
