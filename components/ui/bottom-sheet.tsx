"use client";

import { useState, type ReactNode } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

/**
 * Project-standard bottom sheet wrapper.
 *
 * Why this exists: the shared `DrawerContent` primitive intentionally ships
 * minimal styling (it only owns iOS keyboard handling — see drawer.tsx). The
 * project's actual bottom-sheet look (background, border, title typography,
 * outer padding) lives in feature components and has been hand-applied per
 * sheet. Hand-applying it is error-prone — drawers built without these
 * tokens look out of place AND lose the close-animation if they unmount the
 * inner body the moment `open` flips to false.
 *
 * `BottomSheet` bakes both:
 *   1) The canonical Tailwind class set (matches the existing fixed-expense
 *      sheets).
 *   2) Always-mounted `<Drawer>` driven by `open`, so vaul can play its
 *      slide-down animation when the consumer flips `open` to false.
 *
 * For value-based drawers (where the body needs a non-null target to render),
 * pair this with `useStableNonNull` so the body keeps rendering while vaul
 * animates the close — without it the body unmounts the instant the consumer
 * clears its state and the sheet collapses mid-animation.
 *
 * Note: components/dashboard/friend-switcher.tsx uses Radix `Sheet` rather
 * than vaul `Drawer`. Consolidating it onto `BottomSheet` is tracked at the
 * top of that file; out of scope for this wrapper's migration history.
 */

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Visible title; sized with the project's standard sheet-title typography. */
  title: string;
  /**
   * Optional small muted line rendered under the title. Use for secondary
   * identifiers like a plan name under a service name (catalog/active-item
   * sheets). Omit for sheets with a single title line.
   */
  subtitle?: string;
  /** Screen-reader-only description; required for Radix a11y. */
  description: string;
  /** Pass `true` to render vaul's built-in close (X) button at top-right. */
  showCloseButton?: boolean;
  children: ReactNode;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  description,
  showCloseButton = false,
  children,
}: BottomSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        showCloseButton={showCloseButton}
        className="border-white/10 bg-background px-5 pb-8 pt-2"
      >
        <DrawerHeader className="px-0 pb-3 pt-2 text-left">
          <DrawerTitle className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
            {title}
          </DrawerTitle>
          {subtitle ? (
            <p className="mt-1 text-[13px] font-medium leading-tight text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
          <DrawerDescription className="sr-only">
            {description}
          </DrawerDescription>
        </DrawerHeader>
        {children}
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Returns the most recent non-null `value`. When `value` becomes `null`,
 * returns the previous non-null reading so consumers can keep rendering
 * during a close animation. Implemented with `useState` + the React
 * "Adjusting state when a prop changes" pattern so refs aren't accessed
 * during render (which our lint rule forbids — see active-item-sheet
 * pre-existing warnings).
 *
 * Use this for any sheet whose body needs a non-null payload (e.g.
 * `target`, `item`, `plan`) and whose parent clears that payload on close.
 */
export function useStableNonNull<T>(value: T | null): T | null {
  const [last, setLast] = useState<T | null>(value);
  // React-recommended pattern: derive state from props by comparing during
  // render and calling setState if needed. React will short-circuit the
  // current render and re-run with the new state immediately. See
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (value !== null && value !== last) {
    setLast(value);
  }
  return value ?? last;
}
