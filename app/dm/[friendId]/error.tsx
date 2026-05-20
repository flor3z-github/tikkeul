"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";

export default function DmThreadError({
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
            href="/dm"
            prefetch
            className="inline-flex items-center gap-1 text-muted-foreground"
          >
            <ChevronLeft className="size-4" />
            메시지
          </Link>
        }
        title="DM"
      />
      <div className="mt-4 space-y-3 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">대화를 불러오지 못했어요</p>
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
