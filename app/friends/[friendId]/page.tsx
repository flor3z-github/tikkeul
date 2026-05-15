import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import {
  FriendVisibilityToggles,
  type FriendVisibilityPerms,
} from "@/components/friends/friend-visibility-toggles";
import { RemoveFriendButton } from "@/components/friends/remove-friend-button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
  const { data: row } = await supabase
    .from("friendships")
    .select(
      "show_spending_total, show_spending_items, show_fixed_total, show_fixed_items",
    )
    .eq("owner_id", user.id)
    .eq("viewer_id", friendId)
    .maybeSingle();

  if (!row) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", friendId)
    .maybeSingle();

  const nickname = profile?.display_name ?? "이름 없음";

  const initialPerms: FriendVisibilityPerms = {
    show_spending_total: row.show_spending_total ?? false,
    show_spending_items: row.show_spending_items ?? false,
    show_fixed_total: row.show_fixed_total ?? false,
    show_fixed_items: row.show_fixed_items ?? false,
  };

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

      <div className="mt-8">
        <RemoveFriendButton friendUserId={friendId} nickname={nickname} />
      </div>
    </AppShell>
  );
}
