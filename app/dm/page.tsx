import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { buttonVariants } from "@/components/ui/button";
import { DmIndexRealtimeWatcher } from "@/components/dm/dm-index-realtime-watcher";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeKoreanDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type DmIndexRow = {
  friend_id: string;
  nickname: string;
  thread_id: string | null;
  last_message_id: string | null;
  last_message_content: string | null;
  last_message_sender_id: string | null;
  last_message_at: string | null;
  unread: number;
};

function formatUnreadBadge(n: number): string {
  if (n <= 0) return "";
  if (n > 99) return "99+";
  return String(n);
}

export default async function DmIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: indexRows, error: indexError } = await supabase.rpc(
    "get_my_dm_index",
  );

  if (indexError) {
    return (
      <AppShell>
        <PageHeader
          eyebrow={
            <Link
              href="/dashboard"
              prefetch
              className="inline-flex items-center gap-1 text-muted-foreground"
            >
              <ChevronLeft className="size-4" />
              대시보드
            </Link>
          }
          title="메시지"
        />
        <p className="mt-2 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
          {indexError.message}
        </p>
      </AppShell>
    );
  }

  // RPC already orders by (last_message_at desc nulls last, nickname asc) so
  // we render the result verbatim.
  const items = ((indexRows ?? []) as DmIndexRow[]).map((r) => ({
    ...r,
    unread: Number(r.unread ?? 0),
  }));

  return (
    <AppShell>
      <DmIndexRealtimeWatcher />
      <PageHeader
        eyebrow={
          <Link
            href="/dashboard"
            prefetch
            className="inline-flex items-center gap-1 text-muted-foreground"
          >
            <ChevronLeft className="size-4" />
            대시보드
          </Link>
        }
        title="메시지"
      />

      {items.length === 0 ? (
        <div className="mt-2 rounded-2xl bg-card px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">아직 친구가 없어요</p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            대시보드 상단의 친구 칩에서 친구를 추가해 보세요.
          </p>
          <Link
            href="/dashboard"
            prefetch
            className={cn(buttonVariants({ size: "sm" }), "mt-4")}
          >
            친구 추가하러 가기
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => {
            const isMine = it.last_message_sender_id === user.id;
            const hasMessage = Boolean(it.last_message_id);
            const badge = formatUnreadBadge(it.unread);
            return (
              <li key={it.friend_id}>
                <Link
                  href={`/dm/${it.friend_id}`}
                  prefetch
                  className="block rounded-2xl bg-card px-4 py-3 transition-colors hover:bg-card/80 active:bg-card/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[15px] font-semibold">
                      {it.nickname}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      {hasMessage && it.last_message_at ? (
                        <span className="text-[11px] text-muted-foreground">
                          {formatRelativeKoreanDate(it.last_message_at)}
                        </span>
                      ) : null}
                      {badge ? (
                        <span
                          aria-label={`읽지 않은 메시지 ${it.unread}개`}
                          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-none text-destructive-foreground"
                        >
                          {badge}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 truncate text-[13px] text-muted-foreground">
                    {hasMessage && it.last_message_content
                      ? `${isMine ? "나: " : ""}${it.last_message_content}`
                      : "메시지 없음"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
