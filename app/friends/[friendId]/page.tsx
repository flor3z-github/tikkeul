import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import {
  GroupMembershipList,
  type GroupMembershipRow,
} from "@/components/friends/group-membership-list";
import {
  FriendVisibilityToggles,
  type FriendVisibilityPerms,
} from "@/components/friends/friend-visibility-toggles";
import { RemoveFriendButton } from "@/components/friends/remove-friend-button";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = Promise<{ friendId: string }>;

export default async function FriendDetailPage({
  params,
}: {
  params: Params;
}) {
  const { friendId } = await params;
  if (!UUID_RE.test(friendId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (friendId === user.id) notFound();

  // Outbound row: this user is the owner, the friend is the viewer. RLS
  // ensures only the owner can SELECT the perm columns.
  const [{ data: row }, { data: profile }, { data: groupRows }] =
    await Promise.all([
      supabase
        .from("friendships")
        .select(
          "show_spending_total, show_spending_items, show_fixed_total, show_fixed_items",
        )
        .eq("owner_id", user.id)
        .eq("viewer_id", friendId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", friendId)
        .maybeSingle(),
      supabase
        .from("friend_groups")
        .select("id, name, slug, created_at")
        .eq("owner_id", user.id),
    ]);

  if (!row) notFound();

  const nickname = profile?.display_name ?? "이름 없음";

  const initialPerms: FriendVisibilityPerms = {
    show_spending_total: row.show_spending_total ?? false,
    show_spending_items: row.show_spending_items ?? false,
    show_fixed_total: row.show_fixed_total ?? false,
    show_fixed_items: row.show_fixed_items ?? false,
  };

  // Sort groups: seed first, then by created_at. Same ordering as
  // /friends/groups so the row sequence is consistent between screens.
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

  // Which of the viewer's groups this friend belongs to. One round-trip
  // filtered to (groups owned by me ∩ this friend) — RLS allows it because
  // we own all the groups in `groupIds`.
  let memberSet = new Set<string>();
  if (groups.length > 0) {
    const { data: memberRows } = await supabase
      .from("friend_group_members")
      .select("group_id")
      .eq("member_user_id", friendId)
      .in(
        "group_id",
        groups.map((g) => g.id),
      );
    memberSet = new Set(
      (memberRows ?? []).map((r) => r.group_id as string),
    );
  }

  const groupRowsView: GroupMembershipRow[] = groups.map((g) => ({
    groupId: g.id,
    name: g.name,
    isSeed: g.slug === "close",
    isMember: memberSet.has(g.id),
  }));

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
        title={`${nickname}님에게 보여줄 항목`}
      />

      <p className="mb-4 text-sm text-muted-foreground">
        각 항목을 끄면 친구의 화면에서 해당 블럭이 숨겨져요. 수입과 가용
        예산은 어떤 설정에서도 공개되지 않아요.
      </p>

      <FriendVisibilityToggles
        friendUserId={friendId}
        initialPerms={initialPerms}
      />

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">그룹</h2>
          <Link
            href="/friends/groups"
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            그룹 관리
          </Link>
        </div>
        <p className="mb-3 text-[12px] text-muted-foreground">
          그룹에 추가하면 그 그룹에만 공개한 거래도 친구가 볼 수 있어요.
          친구는 자기가 어떤 그룹에 속해 있는지 알 수 없어요.
        </p>
        <GroupMembershipList
          friendUserId={friendId}
          groups={groupRowsView}
        />
      </section>

      <div className="mt-8">
        <RemoveFriendButton friendUserId={friendId} nickname={nickname} />
      </div>
    </AppShell>
  );
}
