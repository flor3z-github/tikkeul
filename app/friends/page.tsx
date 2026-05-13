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
    supabase
      .from("friendships")
      .select("owner_id")
      .eq("viewer_id", user.id),
  ]);

  const friendIds = (friendsResult.data ?? [])
    .map((row) => row.owner_id)
    .filter((id): id is string => Boolean(id) && id !== user.id);

  const profilesResult =
    friendIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", friendIds)
      : { data: [], error: null as null | { message: string } };

  const friends = (profilesResult.data ?? []).map((row) => ({
    userId: row.id,
    nickname: row.display_name ?? "이름 없음",
  }));

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
