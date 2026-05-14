"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLinkStatus } from "next/link";

import { cn } from "@/lib/utils";

type NavProgressContextValue = {
  pendingCount: number;
  increment: () => void;
  decrement: () => void;
};

const NavProgressContext = createContext<NavProgressContextValue | null>(null);

/**
 * Tracks how many <Link> elements are currently navigating. Each
 * <LinkPending /> child of a <Link> increments the counter when its parent
 * link's transition starts and decrements when it ends. The provider exposes
 * the aggregate count so a single top-of-page bar can reflect navigation
 * state from anywhere in the tree.
 */
export function NavProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pendingCount, setPendingCount] = useState(0);

  const increment = useCallback(() => {
    setPendingCount((n) => n + 1);
  }, []);
  const decrement = useCallback(() => {
    setPendingCount((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo(
    () => ({ pendingCount, increment, decrement }),
    [pendingCount, increment, decrement],
  );

  return (
    <NavProgressContext.Provider value={value}>
      {children}
    </NavProgressContext.Provider>
  );
}

function useNavProgress() {
  return useContext(NavProgressContext);
}

/**
 * Direct child of a <Link>. Uses Next 16's useLinkStatus to bridge that
 * link's pending state into the shared NavProgress context. Render nothing
 * visually; the top bar reflects the aggregate.
 */
export function LinkPending() {
  const status = useLinkStatus();
  const ctx = useNavProgress();

  useEffect(() => {
    if (!ctx || !status.pending) return;
    ctx.increment();
    return () => ctx.decrement();
  }, [ctx, status.pending]);

  return null;
}

/**
 * Variant for callers who already have access to a boolean pending flag
 * (e.g. a chevron that swaps for a spinner). Exposes the same pending bit
 * via the parent <Link> so the top bar fires too.
 */
export function useLinkPendingStatus() {
  const status = useLinkStatus();
  const ctx = useNavProgress();

  useEffect(() => {
    if (!ctx || !status.pending) return;
    ctx.increment();
    return () => ctx.decrement();
  }, [ctx, status.pending]);

  return status.pending;
}

export function NavProgressBar() {
  const ctx = useNavProgress();
  const pending = (ctx?.pendingCount ?? 0) > 0;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden",
        pending ? "opacity-100" : "opacity-0 transition-opacity delay-150",
      )}
    >
      <div
        className={cn(
          "h-full bg-primary",
          pending ? "animate-[nav-progress_1.2s_ease-out_infinite]" : "w-0",
        )}
      />
    </div>
  );
}
