"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

  // Manually lift the sheet above the iOS software keyboard. We read the
  // keyboard height from visualViewport on every resize and write it to
  // `bottom`. Idempotent (no toggling state), so it can't drift across the
  // multi-fire animation window where vaul's logic loses track.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    function applyKeyboardInset() {
      const el = contentRef.current;
      if (!el) return;
      // While the drawer is animating out, the keyboard is also dismissing.
      // If we let `bottom` snap from the lifted value back to 0 mid-close,
      // it jumps and the slide-down animation looks broken. Hold the value
      // until vaul unmounts the content.
      if (el.getAttribute("data-state") === "closed") return;
      const inset = Math.max(0, window.innerHeight - vv!.height);
      // The URL bar shrinks visualViewport by ~50–80px; treat anything below
      // 100px as not-a-keyboard so we don't snap during scroll.
      el.style.bottom = inset > 100 ? `${inset}px` : "";
    }

    vv.addEventListener("resize", applyKeyboardInset);
    applyKeyboardInset();
    return () => {
      vv.removeEventListener("resize", applyKeyboardInset);
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
            className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30"
          />
        ) : null}
        {children}
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
