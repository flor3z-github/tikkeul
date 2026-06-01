import { describe, expect, it } from "vitest";

import { resolveNextTarget } from "@/lib/utils/deep-link";

describe("resolveNextTarget", () => {
  it("forwards /dashboard deep-links (notify-friend-spending)", () => {
    expect(resolveNextTarget("/dashboard")).toBe("/dashboard");
    expect(resolveNextTarget("/dashboard?d=2026-01-01")).toBe(
      "/dashboard?d=2026-01-01",
    );
    expect(resolveNextTarget("/dashboard#focus")).toBe("/dashboard#focus");
  });

  it("forwards /dm deep-links (notify-dm-message: reactions/comments/DM)", () => {
    // Regression: this was the bug — /dm/* was dropped to /dashboard, so
    // tapping a friend's comment notification never opened the DM thread.
    expect(resolveNextTarget("/dm/abc-123")).toBe("/dm/abc-123");
    expect(resolveNextTarget("/dm/uuid?focus=msg1")).toBe("/dm/uuid?focus=msg1");
  });

  it("rejects off-origin URLs (open-redirect guard)", () => {
    expect(resolveNextTarget("https://evil.com")).toBe("/dashboard");
    expect(resolveNextTarget("//evil.com")).toBe("/dashboard");
    expect(resolveNextTarget("http://evil.com/dashboard")).toBe("/dashboard");
  });

  it("rejects prefix-escape lookalikes", () => {
    expect(resolveNextTarget("/dashboardx")).toBe("/dashboard");
    expect(resolveNextTarget("/dmfoo")).toBe("/dashboard");
    expect(resolveNextTarget("/dm-evil")).toBe("/dashboard");
  });

  it("rejects other internal paths not on the allowlist", () => {
    expect(resolveNextTarget("/settings")).toBe("/dashboard");
    expect(resolveNextTarget("/friends")).toBe("/dashboard");
    expect(resolveNextTarget("/login")).toBe("/dashboard");
  });

  it("falls back to /dashboard for empty/missing input", () => {
    expect(resolveNextTarget(undefined)).toBe("/dashboard");
    expect(resolveNextTarget(null)).toBe("/dashboard");
    expect(resolveNextTarget("")).toBe("/dashboard");
  });
});
