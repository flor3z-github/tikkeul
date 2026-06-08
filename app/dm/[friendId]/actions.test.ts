import { beforeEach, describe, expect, it, vi } from "vitest";

// Contract test for markThreadReadAction. This is a CHANGE-DETECTOR, not a
// proof that the unread badge clears on the screen: it pins the action's
// observable contract (auth guard, UUID guard, the RPC call, and — the actual
// bug fix — that BOTH the /dm index and /dashboard paths are revalidated so
// back-navigation refetches the read-cleared counts). The real regression
// guard for the swipe-back behavior is the on-device checklist; the project
// has no component/e2e suite (CLAUDE.md), so the badge-clears assertion can't
// live here.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  // The real redirect() throws to halt the action; mirror that so code after
  // an unauthenticated redirect never runs.
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { markThreadReadAction } from "./actions";

const VALID_THREAD_ID = "11111111-2222-3333-4444-555555555555";

type MockOpts = {
  user?: { id: string } | null;
  rpcError?: { message: string } | null;
};

function mockSupabase({ user = { id: "u-1" }, rpcError = null }: MockOpts = {}) {
  const rpc = vi.fn().mockResolvedValue({ error: rpcError });
  const getUser = vi.fn().mockResolvedValue({ data: { user } });
  const client = { auth: { getUser }, rpc };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return { client, rpc, getUser };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("markThreadReadAction", () => {
  it("redirects to /login when unauthenticated and touches nothing else", async () => {
    const { rpc } = mockSupabase({ user: null });

    await expect(markThreadReadAction(VALID_THREAD_ID)).rejects.toThrow(
      "REDIRECT:/login",
    );

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(rpc).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a malformed thread id before calling the RPC", async () => {
    const { rpc } = mockSupabase();

    const result = await markThreadReadAction("not-a-uuid");

    expect(result).toEqual({ ok: false, error: "잘못된 스레드예요." });
    expect(rpc).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("marks read and revalidates BOTH /dm and /dashboard on success", async () => {
    const { rpc } = mockSupabase();

    const result = await markThreadReadAction(VALID_THREAD_ID);

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("mark_dm_thread_read", {
      p_thread_id: VALID_THREAD_ID,
    });
    // The fix hinges on busting the Router Cache for both unread surfaces.
    expect(revalidatePath).toHaveBeenCalledWith("/dm");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("surfaces the RPC error and skips revalidation when the mark fails", async () => {
    mockSupabase({ rpcError: { message: "rpc boom" } });

    const result = await markThreadReadAction(VALID_THREAD_ID);

    expect(result).toEqual({ ok: false, error: "rpc boom" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
