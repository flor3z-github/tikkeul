"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SavingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell withBottomNav withFab>
      <PageHeader
        eyebrow="매달 차곡차곡 모이는 돈"
        title="돈모으기"
        trailing={
          <Link
            href="/settings"
            prefetch
            aria-label="설정"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-full text-muted-foreground",
            )}
          >
            <Settings className="size-5" />
          </Link>
        }
      />
      <div className="mt-4 space-y-3 rounded-2xl bg-destructive/10 px-4 py-4 text-sm text-destructive">
        <p className="font-semibold">돈모으기를 표시하지 못했어요</p>
        <p className="break-all text-xs opacity-80">{error.message}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => reset()}>
          다시 시도
        </Button>
      </div>
    </AppShell>
  );
}
