"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// IMPORTANT: every bottom sheet in this app must go through DrawerContent so
// the iOS keyboard handling below applies. Do NOT call vaul's
// `<DrawerPrimitive.Content>` directly from feature code, and do NOT collapse
// the keyboard handling into something simpler "because it looks redundant" —
// each piece below addresses a specific quirk that bit us in production. See
// the comments in DrawerContent for the failure modes each line prevents.

function Drawer({
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  // vaul's built-in iOS keyboard repositioning toggles `keyboardIsOpen` on
  // every visualViewport.resize whose diff exceeds 60px. During the keyboard
  // open animation that fires twice and flips the flag back to false, which
  // sends the drawer down the "reset height" branch with a stale top offset.
  // The result on short drawers is that the sheet ends up hidden behind the
  // keyboard or pushed above the viewport top. We handle the inset ourselves
  // in DrawerContent instead.
  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      repositionInputs={repositionInputs}
      {...props}
    />
  );
}

// Nested drawer root. Used when a sheet must open from inside another open
// sheet (e.g. an "add friend" sheet on top of the omnibox sheet). vaul's
// NestedRoot handles parent scaling/restoration automatically; pair it with
// the same `DrawerContent` so the iOS keyboard handler applies at the inner
// level too.
function DrawerNestedRoot({
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.NestedRoot>) {
  return (
    <DrawerPrimitive.NestedRoot
      data-slot="drawer-nested"
      repositionInputs={repositionInputs}
      {...props}
    />
  );
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
        className,
      )}
      {...props}
    />
  );
}

type DrawerContentProps = React.ComponentProps<typeof DrawerPrimitive.Content> & {
  showCloseButton?: boolean;
  showHandle?: boolean;
};

function DrawerContent({
  className,
  children,
  showCloseButton = false,
  showHandle = true,
  ...props
}: DrawerContentProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  // iOS soft-keyboard handling. Two iOS Safari quirks combine to break a
  // naive bottom sheet:
  //   1) When the keyboard opens, visualViewport shrinks but the layout
  //      viewport stays the same. A `position: fixed; bottom: 0` sheet ends
  //      up *behind* the keyboard.
  //   2) When a TEXT input gets focus, iOS scrolls the layout viewport so
  //      the input is centered in the visualViewport. `vv.offsetTop` becomes
  //      positive. A sheet pinned only by layout-viewport coordinates slides
  //      *above* the visible area and the user sees only an empty gap.
  // The fix anchors the sheet's bottom edge to the visualViewport's bottom
  // edge (`window.innerHeight - vv.offsetTop - vv.height`) and clamps its
  // max-height to `vv.height` so it never grows above the visible area.
  // Numeric keypads tend not to scroll the layout viewport (only quirk #1
  // applies); QWERTY/text keyboards trigger both. We must handle both.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    function applyKeyboardInset() {
      const el = contentRef.current;
      if (!el) return;
      // While the drawer is animating out the keyboard is also dismissing.
      // If we let `bottom` snap from the lifted value back to 0 mid-close,
      // it jumps and the slide-down animation looks broken. Hold the value
      // until vaul unmounts the content.
      if (el.getAttribute("data-state") === "closed") return;

      // Treat any meaningful shrink of the visualViewport as a keyboard
      // event. Mobile Safari's URL bar also shrinks vv by ~50–80px when the
      // user scrolls the page; ignore anything below 100px so we don't snap
      // the sheet during ordinary scroll.
      const keyboardHeight = window.innerHeight - vv!.height;
      if (keyboardHeight > 100) {
        // Anchor to the visualViewport bottom (NOT the layout viewport
        // bottom — see quirk #2 above). `vv.offsetTop` is the layout-Y of
        // the visualViewport's top; the bottom of the visualViewport in
        // layout coords is `vv.offsetTop + vv.height`, and the inset from
        // the layout bottom is therefore the value below.
        const bottomInset = Math.max(
          0,
          window.innerHeight - vv!.offsetTop - vv!.height,
        );
        el.style.bottom = `${bottomInset}px`;
        // Clamp to visible viewport — without this a tall sheet's top edge
        // slides above the visualViewport and the user can't reach the
        // first form field.
        el.style.maxHeight = `${vv!.height}px`;
        // Sheets use `pb-8` for breathing room above the safe-area inset
        // when there's no keyboard. With the keyboard up the sheet sits
        // flush against the keyboard, so that bottom padding becomes a
        // visible gap of empty space — drop it.
        el.style.paddingBottom = "0px";
      } else {
        el.style.bottom = "";
        el.style.maxHeight = "";
        el.style.paddingBottom = "";
      }
    }

    vv.addEventListener("resize", applyKeyboardInset);
    // iOS scrolls the visualViewport (not just resizes it) when focusing a
    // text input — without the scroll listener the sheet doesn't follow.
    vv.addEventListener("scroll", applyKeyboardInset);
    applyKeyboardInset();
    // Re-measure across focus changes — iOS sometimes fires the keyboard
    // resize before our content has reflowed, and switching from a numeric
    // input to a text input changes both vv.height and vv.offsetTop in one
    // gesture without a discrete blur+focus cycle.
    const onFocus = () => {
      requestAnimationFrame(applyKeyboardInset);
      setTimeout(applyKeyboardInset, 100);
      setTimeout(applyKeyboardInset, 300);
    };
    window.addEventListener("focusin", onFocus);
    window.addEventListener("focusout", onFocus);
    return () => {
      vv.removeEventListener("resize", applyKeyboardInset);
      vv.removeEventListener("scroll", applyKeyboardInset);
      window.removeEventListener("focusin", onFocus);
      window.removeEventListener("focusout", onFocus);
    };
  }, []);

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={contentRef}
        data-slot="drawer-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md flex-col border-t bg-popover text-popover-foreground shadow-lg outline-none",
          "rounded-t-[28px]",
          // safe-area-aware padding overridden by callers
          className,
        )}
        {...props}
      >
        {showHandle ? (
          <div
            aria-hidden
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
          />
        ) : null}
        {/* Inner scroller: the sheet itself is a fixed-height flex column
            (clamped by maxHeight when the keyboard is open), so any body
            content longer than that has to scroll inside this wrapper or
            it would overflow the viewport. min-h-0 is required for a
            flex child to actually shrink and let overflow take effect. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
        {showCloseButton ? (
          <DrawerPrimitive.Close asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-3 top-3"
              aria-label="닫기"
            >
              <XIcon />
            </Button>
          </DrawerPrimitive.Close>
        ) : null}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  );
}

function DrawerFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-base font-medium text-foreground", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerNestedRoot,
  DrawerTrigger,
  DrawerPortal,
  DrawerClose,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
