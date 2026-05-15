import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { FriendCodeIssueCard } from "@/components/friends/friend-code-issue-card";
import { FriendCodeRedeemForm } from "@/components/friends/friend-code-redeem-form";
import { FriendList } from "@/components/friends/friend-list";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nowIso = new Date().toISOString();
  const [activeCodeResult, friendsResult] = await Promise.all([
    supabase
      .from("friend_codes")
      .select("code, expires_at")
      .eq("owner_id", user.id)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // OUTBOUND direction: rows where this user is the OWNER. These rows
    // carry the visibility flags we want to surface in the per-friend
    // settings drawer (what THIS user exposes to each friend).
    // auto-mutual pairing guarantees the set of viewer_id values here is
    // the same set of users that the previous viewer_id=user.id query
    // returned, so the visible friend list is unchanged.
    supabase
      .from("friendships")
      .select(
        "viewer_id, show_spending_total, show_spending_items, show_fixed_total, show_fixed_items",
      )
      .eq("owner_id", user.id),
  ]);

  type OutboundRow = {
    viewer_id: string | null;
    show_spending_total: boolean;
    show_spending_items: boolean;
    show_fixed_total: boolean;
    show_fixed_items: boolean;
  };
  const outboundRows = (friendsResult.data ?? []) as OutboundRow[];

  const permsByFriendId = new Map<
    string,
    {
      show_spending_total: boolean;
      show_spending_items: boolean;
      show_fixed_total: boolean;
      show_fixed_items: boolean;
    }
  >();
  for (const row of outboundRows) {
    if (!row.viewer_id || row.viewer_id === user.id) continue;
    permsByFriendId.set(row.viewer_id, {
      show_spending_total: row.show_spending_total,
      show_spending_items: row.show_spending_items,
      show_fixed_total: row.show_fixed_total,
      show_fixed_items: row.show_fixed_items,
    });
  }

  const friendIds = Array.from(permsByFriendId.keys());

  const profilesResult =
    friendIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", friendIds)
      : { data: [], error: null as null | { message: string } };

  const friends = (profilesResult.data ?? []).map((row) => {
    const perms = permsByFriendId.get(row.id) ?? {
      show_spending_total: true,
      show_spending_items: true,
      show_fixed_total: false,
      show_fixed_items: false,
    };
    return {
      userId: row.id,
      nickname: row.display_name ?? "이름 없음",
      perms,
    };
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow={
          <Link
            href="/settings"
            prefetch
            className="inline-flex items-center gap-1 text-muted-foreground"
          >
            <ChevronLeft className="size-4" />
            설정
          </Link>
        }
        title="친구"
      />

      <div className="space-y-4">
        <FriendCodeIssueCard
          initialActive={
            activeCodeResult.data
              ? {
                  code: activeCodeResult.data.code,
                  expiresAt: activeCodeResult.data.expires_at,
                }
              : null
          }
        />
        <FriendCodeRedeemForm />
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          친구 ({friends.length})
        </h2>
        <FriendList friends={friends} />
      </section>
    </AppShell>
  );
}
