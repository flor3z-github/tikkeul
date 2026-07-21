"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

type ActionResult = { ok: true } | { ok: false; error: string };

export type SaveStatus = "idle" | "saving" | "saved";

// Per-field auto-save: drives a transient "저장 중…/저장됨 ✓" indicator and
// surfaces failures as a toast. The caller decides what to do with the field
// value on failure (text fields keep it, the cycle row reverts) via the
// returned boolean / onError.
export function useAutoSave() {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const save = useCallback(
    async (
      action: () => Promise<ActionResult>,
      onError?: () => void,
    ): Promise<boolean> => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      setStatus("saving");
      let res: ActionResult;
      try {
        res = await action();
      } catch {
        res = { ok: false, error: "저장에 실패했어요." };
      }
      if (res.ok) {
        setStatus("saved");
        timer.current = setTimeout(() => setStatus("idle"), 1500);
        return true;
      }
      setStatus("idle");
      toast.error(res.error);
      onError?.();
      return false;
    },
    [],
  );

  return { status, save };
}

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span
      aria-live="polite"
      className="flex items-center gap-1 text-xs text-muted-foreground"
    >
      {status === "saving" ? (
        "저장 중…"
      ) : (
        <>
          <Check className="size-3.5 text-emerald-600" aria-hidden />
          저장됨
        </>
      )}
    </span>
  );
}
