import { redirect } from "next/navigation";

import { GroupsPage } from "@/components/friends/groups/groups-page";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";

export type GroupsPageGroup = {
  id: string;
  name: string;
  isSeed: boolean;
  memberCount: number;
  /** First 3 member nicknames for the inline preview. */
  previewMemberNicknames: string[];
};

export type GroupsPageFriend = {
  userId: string;
  nickname: string;
};

export default async function FriendGroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch the viewer's groups in parallel with the outgoing-friendships
  // list. Friends are needed for the create/edit dialogs' member picker.
  // Order groups (seed first, then created_at) on the client — Postgres
  // can do this with CASE but PostgREST's `order` clause is a hassle to
  // express it through, and the row count is bounded by the 0044 cap (≤ 10).
  const [{ data: groupRows }, { data: friendshipRows }] = await Promise.all([
    supabase
      .from("friend_groups")
      .select("id, name, slug, created_at")
      .eq("owner_id", user.id),
    supabase
      .from("friendships")
      .select("viewer_id")
      .eq("owner_id", user.id),
  ]);

  const groups = (groupRows ?? [])
    .map((g) => ({
      id: g.id as string,
      name: g.name as string,
      slug: g.slug as string | null,
      created_at: g.created_at as string,
    }))
    .sort((a, b) => {
      const aSeed = a.slug === "close" ? 0 : 1;
      const bSeed = b.slug === "close" ? 0 : 1;
      if (aSeed !== bSeed) return aSeed - bSeed;
      return a.created_at.localeCompare(b.created_at);
    });

  // One round-trip for members across all groups, one combined round-trip
  // for member + friend profile rows. Keeps the query count constant
  // regardless of group/friend count.
  const groupIds = groups.map((g) => g.id);
  const friendIds = (friendshipRows ?? []).map((f) => f.viewer_id as string);

  let memberRows: Array<{ group_id: string; member_user_id: string }> = [];
  let nicknameById = new Map<string, string>();

  if (groupIds.length > 0) {
    const { data: members } = await supabase
      .from("friend_group_members")
      .select("group_id, member_user_id")
      .in("group_id", groupIds);
    memberRows = (members ?? []).map((m) => ({
      group_id: m.group_id as string,
      member_user_id: m.member_user_id as string,
    }));
  }

  // Fetch nicknames for the union of (group members) ∪ (friends). The
  // friend-multi-picker needs every friend, and the group preview needs every
  // member. They overlap heavily so we union the ids and fetch once.
  const allProfileIds = Array.from(
    new Set([...memberRows.map((m) => m.member_user_id), ...friendIds]),
  );
  if (allProfileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", allProfileIds);
    nicknameById = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        ((p.display_name as string | null)?.trim() || "이름 없음"),
      ]),
    );
  }

  // Build the per-group view rows. previewMemberNicknames are sorted in the
  // same order the membership rows came back (Postgres physical order); we
  // re-sort by nickname for a more stable, scannable preview.
  const membersByGroup = new Map<string, string[]>();
  for (const m of memberRows) {
    const list = membersByGroup.get(m.group_id) ?? [];
    list.push(m.member_user_id);
    membersByGroup.set(m.group_id, list);
  }

  const viewFriends: GroupsPageFriend[] = friendIds
    .map((id) => ({
      userId: id,
      nickname: nicknameById.get(id) ?? "이름 없음",
    }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"));

  const viewGroups: GroupsPageGroup[] = groups.map((g) => {
    const memberIds = membersByGroup.get(g.id) ?? [];
    const memberNicknames = memberIds
      .map((id) => nicknameById.get(id) ?? "이름 없음")
      .sort((a, b) => a.localeCompare(b, "ko"));
    return {
      id: g.id,
      name: g.name,
      isSeed: g.slug === "close",
      memberCount: memberIds.length,
      previewMemberNicknames: memberNicknames.slice(0, 3),
    };
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow={
          <a
            href="/dashboard"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            ◀ 대시보드
          </a>
        }
        title="친구 그룹"
        subtitle="거래마다 어떤 친구가 볼지 그룹으로 묶어 정해요."
      />

      <GroupsPage groups={viewGroups} friends={viewFriends} />
    </AppShell>
  );
}
