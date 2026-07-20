"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, HandCoins, Sprout, Wallet } from "lucide-react";

import { useNavCollapsed } from "@/hooks/use-nav-collapsed";
import { LinkPending } from "@/components/layout/nav-progress";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  Icon: typeof Wallet;
};

const TABS: Tab[] = [
  { href: "/dashboard", label: "소비", Icon: Wallet },
  { href: "/fixed-expenses", label: "고정지출", Icon: CalendarDays },
  { href: "/savings", label: "돈모으기", Icon: Sprout },
  { href: "/income", label: "수입", Icon: HandCoins },
];

// Collapsed-pill geometry (px). Keep in sync with the spec §5 and with
// --bottom-nav-clearance in globals.css (12px float + 64px expanded height,
// the latter also expressed as the `h-16` class on <nav> below).
const SLOT_W = 48;
const COLLAPSED_W = TABS.length * SLOT_W + 16; // 208
const COLLAPSED_H = 52;
// Icon drops to the collapsed pill's vertical center once the label fades.
const COLLAPSED_TY = 8;

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const DURATION = "260ms";

export function BottomTabNav() {
  const pathname = usePathname();
  const collapsed = useNavCollapsed();
  const navRef = useRef<HTMLElement>(null);

  // Rail width varies with viewport (≤ max-w-md). Derive each tab's
  // collapse translate target once per mount/resize — never per frame —
  // and expose them as CSS vars so the transition runs purely on the
  // compositor (transform/opacity only; box-size transitions are banned
  // on iOS, see spec §3).
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const apply = () => {
      const railW = el.offsetWidth;
      TABS.forEach((_, i) => {
        const expandedCx = ((i + 0.5) / TABS.length) * railW;
        const collapsedCx = railW / 2 + (i - (TABS.length - 1) / 2) * SLOT_W;
        el.style.setProperty(`--tx-${i}`, `${collapsedCx - expandedCx}px`);
      });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="주요 네비게이션"
      className="fixed inset-x-5 z-40 mx-auto h-16 w-auto max-w-[calc(28rem-40px)]"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      {/* Twin glass layers — fixed geometry each, opacity crossfade only.
          Each owns its full bg/blur/border/shadow, so nothing gets clipped
          away mid-morph (a single clip-path'd surface would clip its own
          box-shadow and border — spec §5.2). Width/height below are constant
          per layer and never transitioned — only opacity animates, so this
          does not violate the no-box-size-transition rule. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-[32px]",
          "border border-white/45 bg-[var(--surface-glass)] shadow-[0_12px_40px_rgba(0,0,0,0.14)]",
          "supports-[backdrop-filter:blur(1px)]:backdrop-blur-xl",
          "supports-[not(backdrop-filter:blur(1px))]:bg-white/95",
          "transition-opacity motion-reduce:transition-none",
          collapsed ? "opacity-0" : "opacity-100",
        )}
        style={{ transitionDuration: DURATION, transitionTimingFunction: EASE }}
      />
      <div
        aria-hidden
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
          "border border-white/45 bg-[var(--surface-glass)] shadow-[0_12px_40px_rgba(0,0,0,0.14)]",
          "supports-[backdrop-filter:blur(1px)]:backdrop-blur-xl",
          "supports-[not(backdrop-filter:blur(1px))]:bg-white/95",
          "transition-opacity motion-reduce:transition-none",
          collapsed ? "opacity-100" : "opacity-0",
        )}
        style={{
          width: COLLAPSED_W,
          height: COLLAPSED_H,
          transitionDuration: DURATION,
          transitionTimingFunction: EASE,
        }}
      />

      <ul className="relative grid h-full grid-cols-4">
        {TABS.map(({ href, label, Icon }, i) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex items-stretch justify-center">
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={cn(
                  // Fixed 48px hit-box in BOTH states (≥44px, spec §8):
                  // full-slot-width links would overlap once translated.
                  "flex w-12 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  "transition-transform motion-reduce:transition-none",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                style={{
                  transform: collapsed
                    ? `translate(var(--tx-${i}), ${COLLAPSED_TY}px)`
                    : "translate(0px, 0px)",
                  transitionDuration: DURATION,
                  transitionTimingFunction: EASE,
                }}
              >
                <Icon
                  className={cn(
                    "size-5 shrink-0",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "transition-opacity motion-reduce:transition-none",
                    // Fade the label out fast ahead of the shape change, and
                    // back in slightly late so text never overlaps the
                    // collapsed pill boundary (spec §5.2-3).
                    collapsed
                      ? "opacity-0 duration-[120ms]"
                      : "opacity-100 delay-100 duration-150",
                  )}
                >
                  {label}
                </span>
                <LinkPending />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
