import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type ActiveFriendCode = {
  code: string;
  expiresAt: string;
};

// Reads the caller's most recently issued friend code that is still unused
// and unexpired. Returns null when there's no active code. Shared by every
// surface that opens the friend-add sheet so they all show the same in-flight
// code (preventing accidental re-issues that invalidate the link a user
// already shared with a friend).
export const getActiveFriendCode = cache(
  async (userId: string): Promise<ActiveFriendCode | null> => {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();

    const { data } = await supabase
      .from("friend_codes")
      .select("code, expires_at")
      .eq("owner_id", userId)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return { code: data.code, expiresAt: data.expires_at };
  },
);
