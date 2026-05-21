"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Hand, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  MINI_OFFSET_FAR_X,
  MINI_OFFSET_FAR_Y,
  MINI_SIZE,
  SPEED_DIAL_EVENT_COLLAPSE,
  SPEED_DIAL_EVENT_EXPAND,
} from "@/components/transactions/add-transaction-button";

// Bumping this resets the guide for everyone — useful if we add a second
// long-press feature later and want the existing population to see the
// updated message.
export const LONG_PRESS_GUIDE_FLAG = "tikkeul.guide.income_longpress.seen";

// Selector for the floating add-transaction FAB. Co-located here so the
// AddTransactionButton and this overlay stay in sync via a single string.
const FAB_SELECTOR = '[data-fab="add-transaction"]';

const TOTAL_STEPS = 2;

type Rect = { cx: number; cy: number; w: number; h: number };

/**
 * Two-step onboarding overlay teaching the long-press → speed-dial gesture
 * and what the new "수입 추가" option does.
 *
 * Mounted by the dashboard only when the viewer has at least one transaction
 * — first-time users learn the primary tap action before discovering the
 * secondary long-press action. Skips silently if localStorage is unavailable
 * (private browsing) so users in that mode aren't blocked from the dashboard.
 *
 * Step 1 (1/2): teach the gesture — "FAB를 꾸욱 누르면 메뉴가 위로 열려요".
 *   Spotlight + pulse rings sit on the FAB.
 * Step 2 (2/2): explain the new action — dispatches a speed-dial expand
 *   event so the FAB shows its full menu, then moves the spotlight +
 *   pulse rings to the "수입 추가" mini at its expanded position.
 *
 * Dismissing — via the explicit button, Esc, or any tap outside the card —
 * collapses the speed-dial and writes the flag so the guide doesn't reappear.
 */
export function LongPressGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [fabRect, setFabRect] = useState<Rect | null>(null);
  const [viewportH, setViewportH] = useState<number>(() =>
    typeof window === "undefined" ? 0 : window.innerHeight,
  );
  // Strict-mode in dev mounts effects twice. Guard the initial show so we
  // don't race two timers against the same localStorage flag.
  const triggeredOnceRef = useRef(false);

  function measureFab(): boolean {
    if (typeof document === "undefined") return false;
    const el = document.querySelector<HTMLElement>(FAB_SELECTOR);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const next = {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      w: rect.width,
      h: rect.height,
    };
    // Dedup by value: setFabRect({...}) with structurally equal values still
    // creates a new object identity, which forces a re-render and makes
    // motion's `animate` prop look "changed" on every scroll frame. That
    // restarts the infinite pulse animation and reads as flicker.
    setFabRect((prev) => {
      if (
        prev &&
        prev.cx === next.cx &&
        prev.cy === next.cy &&
        prev.w === next.w &&
        prev.h === next.h
      ) {
        return prev;
      }
      return next;
    });
    return true;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (triggeredOnceRef.current) return;
    triggeredOnceRef.current = true;
    try {
      if (window.localStorage.getItem(LONG_PRESS_GUIDE_FLAG) === "1") return;
    } catch {
      // localStorage blocked (private mode) — skip the guide entirely so the
      // user isn't blocked behind a flag we can't remember dismissing.
      return;
    }
    // Wait a beat for the dashboard to paint + the FAB to finish positioning
    // (the FAB renders inside a Suspense'd section). Without this delay,
    // getBoundingClientRect frequently returns a zeroed rect on first paint
    // and the spotlight lands in the wrong place.
    const id = window.setTimeout(() => {
      if (measureFab()) {
        setStep(1);
        setOpen(true);
      }
    }, 800);
    return () => window.clearTimeout(id);
  }, []);

  // Keep the spotlight pinned to the FAB through orientation changes,
  // soft-keyboard open/close, and viewport resize. The FAB itself is
  // position:fixed, so scrolling does not move it; listening to `scroll`
  // would cause 60fps re-render churn that restarts the infinite pulse
  // animation and reads as flicker. `resize` plus visualViewport (mobile
  // Safari's address-bar shrink fires there) covers the real cases.
  useEffect(() => {
    if (!open) return;
    function update() {
      measureFab();
      setViewportH(window.innerHeight);
    }
    window.addEventListener("resize", update);
    const vv =
      typeof window !== "undefined" ? window.visualViewport : null;
    vv?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      vv?.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Drive the speed-dial state from the current step so step 2 highlights
  // the live menu. The cleanup branch fires on unmount AND on step changes,
  // but we re-dispatch the correct event on the next effect run so the
  // intermediate "collapse" doesn't leak through.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!open) {
      window.dispatchEvent(new Event(SPEED_DIAL_EVENT_COLLAPSE));
      return;
    }
    if (step === 2) {
      window.dispatchEvent(new Event(SPEED_DIAL_EVENT_EXPAND));
    } else {
      window.dispatchEvent(new Event(SPEED_DIAL_EVENT_COLLAPSE));
    }
  }, [open, step]);

  function dismiss() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(SPEED_DIAL_EVENT_COLLAPSE));
    }
    try {
      window.localStorage.setItem(LONG_PRESS_GUIDE_FLAG, "1");
    } catch {
      // ignore — guide will reappear next visit, which is acceptable
      // degraded behavior in private mode.
    }
    setOpen(false);
  }

  function advanceOrFinish() {
    if (step < TOTAL_STEPS) {
      setStep((current) => current + 1);
    } else {
      dismiss();
    }
  }

  if (typeof window === "undefined") return null;
  if (!open || !fabRect) return null;

  // Step 1 highlights the FAB itself. Step 2 highlights the "수입 추가"
  // mini at its expanded position — computed from the shared offset
  // constants so the two components don't drift apart over time. The
  // horizontal speed-dial layout puts 수입 to the LEFT of the FAB (X
  // offset negative); the vertical layout would have used a Y offset.
  // Both are present so either orientation works without code changes
  // here.
  const target: Rect =
    step === 2
      ? {
          cx: fabRect.cx + MINI_OFFSET_FAR_X,
          cy: fabRect.cy + MINI_OFFSET_FAR_Y,
          w: MINI_SIZE,
          h: MINI_SIZE,
        }
      : fabRect;

  // Spotlight radius: a bit larger than the target so the bright disc reads
  // as "look here" rather than tracing the button edge exactly. The +40px
  // ramp is the soft transition to the dim region.
  const spotlightRadius = Math.max(target.w, target.h) * 0.85;

  // Card position. Anchored at the FAB's "above-the-top-edge + 24px"
  // bottom value, then translated up via motion's `y` for step 2 so the
  // card sits above the mini button. Animating `transform` instead of
  // `bottom` keeps the spring on the compositor — animating layout
  // properties here caused the nested infinite pulse rings to flicker
  // during re-renders.
  const anchorBottom = viewportH - fabRect.cy + fabRect.h / 2 + 24;
  const targetBottom = viewportH - target.cy + target.h / 2 + 24;
  const cardY = anchorBottom - targetBottom;

  const isLastStep = step === TOTAL_STEPS;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="long-press-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="long-press-guide-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={dismiss}
        className="fixed inset-0 z-[100]"
        style={{
          // Radial dim: transparent at target center, ramps to 65% black
          // around the spotlight ring. A pure overlay would either obscure
          // the highlighted element or require an SVG mask cutout; the
          // gradient does the same thing with one CSS property and zero
          // extra DOM nodes. The center snaps between steps because CSS
          // can't interpolate gradient stops smoothly — the moving card
          // and pulse rings (which DO transition via motion) carry the
          // visual continuity instead.
          background: `radial-gradient(circle at ${target.cx}px ${target.cy}px, rgba(0,0,0,0) ${spotlightRadius}px, rgba(0,0,0,0.65) ${spotlightRadius + 40}px)`,
        }}
      >
        {/* Two staggered pulse rings on the target so the "look here" cue
            reads as a soft heartbeat instead of a single flash. The
            outer container is anchored at the FAB's initial position via
            non-animated `left`/`top`/`width`/`height` and shifted to the
            current target with transform-only `x`/`y`/`scale`. Animating
            transform instead of layout keeps the motion on the compositor
            and stops the inner infinite pulses from flickering during
            re-renders. */}
        <motion.span
          aria-hidden
          // No border on the container itself: a static ring here would
          // double up with the inner pulses at cycle restart and flash
          // brighter for one frame. The two inner pulses below carry all
          // the "look here" weight, fading in and out so the keyframe
          // loop seam is invisible (both ends at opacity 0).
          className="pointer-events-none rounded-full"
          initial={false}
          animate={{
            x: target.cx - fabRect.cx,
            y: target.cy - fabRect.cy,
            scale: target.w / fabRect.w,
          }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          style={{
            position: "absolute",
            left: fabRect.cx - fabRect.w / 2,
            top: fabRect.cy - fabRect.h / 2,
            width: fabRect.w,
            height: fabRect.h,
            // willChange hints the browser to promote this element to its
            // own compositor layer up front so the spring + nested pulse
            // don't trigger a paint on every frame.
            willChange: "transform",
          }}
        >
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-white/80"
            // Opacity ramps 0 → peak → 0 over the cycle so the keyframe
            // loop seam is invisible — without the trailing 0 the ring
            // would jump back to peak opacity in one frame and read as a
            // flash at the base scale (or, with the now-removed static
            // outer border, overlay it for a brighter pop).
            animate={{ scale: [1, 1.7], opacity: [0, 0.7, 0] }}
            transition={{
              duration: 1.6,
              times: [0, 0.25, 1],
              repeat: Infinity,
              ease: "easeOut",
            }}
            style={{ willChange: "transform, opacity" }}
          />
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-white/55"
            animate={{ scale: [1, 1.7], opacity: [0, 0.5, 0] }}
            transition={{
              duration: 1.6,
              times: [0, 0.25, 1],
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.5,
            }}
            style={{ willChange: "transform, opacity" }}
          />
        </motion.span>

        {/* Hint card. Stop click propagation so a tap inside the card
            doesn't dismiss before the user reads the message — the
            primary button is the explicit progression. Centering is
            handled via motion's `x: -50%` so the spring's `y` and the
            horizontal centering both live on the same transform. */}
        <motion.div
          onClick={(event) => event.stopPropagation()}
          initial={false}
          animate={{ x: "-50%", y: cardY }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          style={{
            position: "fixed",
            left: "50%",
            bottom: anchorBottom,
            willChange: "transform",
          }}
          className="w-[min(296px,calc(100vw-32px))] rounded-3xl border border-white/10 bg-card px-5 py-4 text-card-foreground shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        >
          {/* Step transitions: keyed so motion crossfades the inner content
              when `step` changes, keeping the card frame steady. */}
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
              >
                <div className="flex items-center gap-2 text-primary">
                  <Hand className="size-4" aria-hidden />
                  <span
                    id="long-press-guide-title"
                    className="text-[13px] font-semibold tracking-[-0.01em]"
                  >
                    새로운 사용법
                  </span>
                </div>
                <p className="mt-2 text-[14px] leading-snug">
                  <span className="font-semibold">FAB를 꾸욱 누르면</span>{" "}
                  메뉴가 위로 열려요.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
              >
                <div className="flex items-center gap-2 text-primary">
                  <Wallet className="size-4" aria-hidden />
                  <span
                    id="long-press-guide-title"
                    className="text-[13px] font-semibold tracking-[-0.01em]"
                  >
                    수입 추가
                  </span>
                </div>
                <p className="mt-2 text-[14px] leading-snug">
                  메뉴에서{" "}
                  <span className="font-semibold">‘수입 추가’</span>를
                  누르면 보너스나 환급 같은 일회성 수입을 이번 주기에
                  반영할 수 있어요.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {step}/{TOTAL_STEPS}
            </span>
            <Button
              type="button"
              size="sm"
              onClick={advanceOrFinish}
              autoFocus
              className="h-9 rounded-full px-4 text-[13px] font-semibold"
            >
              {isLastStep ? "확인" : "다음"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
