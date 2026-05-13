"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { createFriendCodeAction } from "@/app/friends/actions";
import { Button } from "@/components/ui/button";

type ActiveCode = {
  code: string;
  expiresAt: string;
};

type Props = {
  initialActive: ActiveCode | null;
};

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60).toString().padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function FriendCodeIssueCard({ initialActive }: Props) {
  // After mount, local state owns the active code (the issue action updates it
  // directly). Server revalidation re-renders this component with a fresh
  // `initialActive`, which we ignore here to avoid clobbering optimistic
  // updates; the page-level Suspense boundary remounts on real navigation.
  const [active, setActive] = useState<ActiveCode | null>(initialActive);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const remainingMs = useMemo(() => {
    if (!active) return 0;
    return new Date(active.expiresAt).getTime() - now;
  }, [active, now]);

  const expired = active != null && remainingMs <= 0;

  function handleIssue() {
    startTransition(async () => {
      const result = await createFriendCodeAction();
      if (result.ok) {
        setActive({ code: result.code, expiresAt: result.expiresAt });
        toast.success("친구 코드를 발급했어요.");
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleCopy() {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.code);
      toast.success("코드를 복사했어요.");
    } catch {
      toast.error("복사에 실패했어요. 직접 입력해주세요.");
    }
  }

  if (!active || expired) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">친구 코드 발급</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          6자리 코드를 발급해 친구에게 공유하면, 친구가 코드를 입력해
          서로 티끌을 볼 수 있어요.
        </p>
        <Button
          type="button"
          onClick={handleIssue}
          disabled={pending}
          className="mt-4 h-12 w-full rounded-full text-[15px] font-semibold"
        >
          {pending ? "발급 중…" : expired ? "다시 발급하기" : "친구 코드 발급"}
        </Button>
        {expired ? (
          <p className="mt-2 text-xs text-muted-foreground">
            이전 코드는 만료됐어요.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">친구 코드</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        친구가 직접 입력할 수 있도록 공유해주세요.
      </p>
      <div className="mt-4 flex items-center justify-center rounded-2xl bg-muted py-5 font-mono text-[32px] font-bold tracking-[0.3em]">
        {active.code}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {formatRemaining(remainingMs)} 후 만료
      </p>
      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleCopy}
          className="h-11 flex-1 rounded-full"
        >
          <Copy className="mr-2 size-4" />
          복사
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleIssue}
          disabled={pending}
          className="h-11 flex-1 rounded-full"
        >
          <RefreshCw className="mr-2 size-4" />
          {pending ? "발급 중…" : "새로 발급"}
        </Button>
      </div>
    </div>
  );
}
