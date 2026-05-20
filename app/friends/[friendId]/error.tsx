"use client";

import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";

export default function FriendDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell>
      <PageHeader
        eyebrow={
          <Link
            href="/dashboard"
            prefetch
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            ◀ 대시보드
          </Link>
        }
        title="친구"
      />
      <div className="mt-4 space-y-3 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">친구 정보를 불러오지 못했어요</p>
        <p className="break-all text-xs opacity-80">{error.message}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => reset()}
        >
          다시 시도
        </Button>
      </div>
    </AppShell>
  );
}
