"use client";

import { useEffect } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[티끌] route error:", error);
  }, [error]);

  return (
    <AppShell>
      <PageHeader eyebrow="문제가 생겼어요" title="잠시 후 다시 시도해주세요" />

      <div className="space-y-4 rounded-3xl border border-destructive/20 bg-destructive/5 px-5 py-6 text-sm text-destructive">
        <p>
          예상치 못한 오류가 발생했어요. 새로고침해도 같은 문제가 반복되면
          잠시 후 다시 열어주세요.
        </p>
        {error.digest ? (
          <p className="text-xs opacity-70">디버그 ID: {error.digest}</p>
        ) : null}
      </div>

      <div className="mt-6 flex gap-2">
        <Button
          type="button"
          onClick={() => reset()}
          className="h-12 flex-1 rounded-full text-[15px] font-semibold"
        >
          다시 시도
        </Button>
      </div>
    </AppShell>
  );
}
