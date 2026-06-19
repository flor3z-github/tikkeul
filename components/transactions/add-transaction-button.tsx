"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Receipt, Wallet } from "lucide-react";

import { IncomeFormDialog } from "@/components/income/income-form-dialog";
import { toISODate } from "@/lib/utils/date";
import {
  TransactionFormDialog,
  type TransactionFormCategory,
  type TransactionFormGroup,
} from "./transaction-form-dialog";

type AddTransactionButtonProps = {
  categories: TransactionFormCategory[];
  /** Owner's friend groups (seed + user-defined), forwarded to the form so
   *  the visibility selector can render. Empty until the data loads. */
  groups?: TransactionFormGroup[];
  /** YYYY-MM-DD. Pre-fills the date field when opening in create mode. */
  defaultDate?: string;
  /** Inclusive start of the currently viewed budget cycle. Forwarded to the
   *  income drawer so its calendar picker is bounded to the visible cycle. */
  cycleStart: Date;
  /** Exclusive end of the currently viewed budget cycle. */
  cycleEnd: Date;
};

// Long-press window: tuned so a deliberate hold is unambiguous but a normal
// tap never crosses it. Anything below ~350ms gets mistaken for a slow tap;
// anything above ~700ms feels unresponsive.
const LONG_PRESS_MS = 500;
// Drag tolerance before a long-press is canceled. Mobile users sometimes
// jitter their thumb a few pixels while holding — `8px` filters that out
// without swallowing real scroll intent.
const MOVE_THRESHOLD_PX = 8;

// Box morph layout.
// Collapsed: 56×56 circle (FAB only).
// Pressing : 62×62 perfect circle (every corner = size/2). The bulge reads
//            as "the circle, slightly bigger" rather than a rounded square.
// Expanded : 168×104 rounded rectangle with two rows. The 수입 row spans
//            the full top (48 tall) to avoid an empty top-right corner; the
//            소비 row sits in the bottom-left next to the FAB (56 tall to
//            match the FAB):
//
//   ┌──────────────────────────┐
//   │  💼  수입 추가              │  48 tall, 168 wide
//   ├──────────────┬───────────┤
//   │  🧾  소비 추가  │     X     │  56 tall, 112 + 56 split
//   └──────────────┴───────────┘
//
// The wrapper is anchored at right + bottom, so width/height changes push
// only the LEFT and TOP edges outward; the FAB itself stays put.
const FAB_SIZE = 56;
const PRESSING_SIZE = 62;
const EXPANDED_W = 168;
// The bottom row must match the FAB (so the FAB sits flush in its corner);
// the top row is shorter to shrink the visual gap between the two labels
// without crowding the icon+text content.
const ROW_H_BOTTOM = FAB_SIZE; // 56
const ROW_H_TOP = 48;
const EXPANDED_H = ROW_H_TOP + ROW_H_BOTTOM; // 104
const ROW_PAD_X = 20;
const FAB_COL = FAB_SIZE; // bottom-right square reserved for the FAB
const CORNER_RADIUS = 28;
// Pressing keeps the FAB a perfect circle while it inflates: every corner is
// size/2 so the 62×62 reads as "the original circle, slightly bigger" rather
// than a rounded square. The visual cue for "growing up-left" comes from the
// right+bottom anchor — width/height grows push the LEFT/TOP edges out while
// the bottom-right stays pinned, so the circle visibly bulges in that
// direction without needing asymmetric corner radii.
const CORNER_RADIUS_PRESSING = PRESSING_SIZE / 2;

// Mini button positions, measured from the FAB center. The 수입 row spans
// the full width, so its visual focus sits at the row's content area
// (icon + label center) rather than its geometric middle — the spotlight
// otherwise lands too far right and clips the label. The 소비 row is to
// the left of the FAB at the same vertical row.
//   FAB center is at right_edge − 28 from the box's right edge.
//   수입 row content sits ~90 px from the box's right edge regardless of
//   box width (content is left-anchored with paddingLeft + icon + gap +
//   label). With box width 168, that puts the content center at
//   −(168 − 90) + 28 = −50 from FAB center.
// Exported so the long-press onboarding guide can highlight 수입 at its
// real screen position without a DOM measurement.
export const MINI_SIZE = FAB_SIZE;
export const MINI_OFFSET_FAR_X = -50;
// Vertical distance from the FAB center (bottom row) to the top row's
// content center. Bottom row center sits at ROW_H_BOTTOM/2 above the box's
// bottom; top row center sits at ROW_H_TOP/2 below the box's top. The
// box-internal distance is therefore (ROW_H_BOTTOM/2 + ROW_H_TOP/2).
export const MINI_OFFSET_FAR_Y = -(ROW_H_BOTTOM / 2 + ROW_H_TOP / 2);

// Window-event channel used by the long-press onboarding guide to drive the
// menu open/closed without prop drilling. The guide expands the menu on
// step 2 so the spotlight can highlight the "수입 추가" row at its real
// expanded position, and collapses it on dismiss. Exported so the guide
// dispatches against the same constants.
export const SPEED_DIAL_EVENT_EXPAND = "tikkeul:speed-dial-expand";
export const SPEED_DIAL_EVENT_COLLAPSE = "tikkeul:speed-dial-collapse";
const EVENT_EXPAND = SPEED_DIAL_EVENT_EXPAND;
const EVENT_COLLAPSE = SPEED_DIAL_EVENT_COLLAPSE;

export function AddTransactionButton({
  categories,
  groups,
  defaultDate,
  cycleStart,
  cycleEnd,
}: AddTransactionButtonProps) {
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  // Box-morph speed-dial. Long-press grows the FAB up + left into a
  // 180×112 rounded rectangle. A short tap on the FAB stays the zero-cost
  // primary path to "소비 추가".
  const [expanded, setExpanded] = useState(false);
  // Press feedback: while the user is holding before the long-press
  // fires, the FAB bumps in size and its top-left corner rounds out
  // more than the others, so the user sees the FAB visibly "leaning"
  // up-left toward where the menu will appear.
  const [pressing, setPressing] = useState(false);

  const timerRef = useRef<number | null>(null);
  // `triggered` doubles as "suppress the next tap" — set by both the
  // long-press timer firing and the move-threshold cancellation, so a
  // released-after-scroll pointer doesn't synthesize a transaction-add tap.
  const triggeredRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function cancelPress() {
    clearTimer();
    setPressing(false);
    startRef.current = null;
  }

  function expand() {
    setExpanded(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(15);
    }
  }

  function collapse() {
    setExpanded(false);
  }

  // Listen for the onboarding guide's expand/collapse signals. The guide
  // toggles the menu during step 2 so the spotlight + pulse rings can
  // highlight the "수입 추가" row at its real position. Plain window
  // events keep the contract one-way (guide drives the FAB; the FAB never
  // emits these) so there's no risk of accidental feedback loops.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onExpand() {
      setExpanded(true);
    }
    function onCollapse() {
      setExpanded(false);
    }
    window.addEventListener(EVENT_EXPAND, onExpand);
    window.addEventListener(EVENT_COLLAPSE, onCollapse);
    return () => {
      window.removeEventListener(EVENT_EXPAND, onExpand);
      window.removeEventListener(EVENT_COLLAPSE, onCollapse);
    };
  }, []);

  function startPress(event: React.PointerEvent<HTMLButtonElement>) {
    // Only respond to the primary pointer. Right-click / Apple Pencil
    // secondary press would otherwise leak into the long-press path.
    if (event.button !== 0) return;
    triggeredRef.current = false;
    startRef.current = { x: event.clientX, y: event.clientY };
    setPressing(true);
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      triggeredRef.current = true;
      setPressing(false);
      expand();
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (timerRef.current == null) return;
    const start = startRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) {
      // Treat as scroll intent: drop the long-press AND suppress the tap
      // that would otherwise fire on pointer-up.
      cancelPress();
      triggeredRef.current = true;
    }
  }

  function handlePointerUp() {
    const triggered = triggeredRef.current;
    cancelPress();
    // Long-press already opened the menu; nothing left to do on
    // pointer-up. A move-threshold cancel also sets `triggered` so a
    // scroll release doesn't fall through to the tap branch.
    if (triggered) return;
    // Short tap behavior depends on the menu state. Collapsed → the
    // primary 소비 추가 path. Expanded → collapse (so users can dismiss
    // the menu by tapping the FAB itself, matching their expectation that
    // re-pressing the trigger closes what it opened).
    if (expanded) {
      collapse();
    } else {
      setTransactionOpen(true);
    }
  }

  const incomeDefaultDate = defaultDate ?? toISODate(new Date());

  // Target geometry per state. Pressing keeps the FAB a perfect circle while
  // it inflates 56→62 (all corners = size/2); the right+bottom anchor pushes
  // the bulge toward the upper-left.
  const boxWidth = expanded
    ? EXPANDED_W
    : pressing
      ? PRESSING_SIZE
      : FAB_SIZE;
  const boxHeight = expanded
    ? EXPANDED_H
    : pressing
      ? PRESSING_SIZE
      : FAB_SIZE;
  const cornerAll =
    !expanded && pressing ? CORNER_RADIUS_PRESSING : CORNER_RADIUS;
  const cornerTopLeft = cornerAll;
  const cornerTopRight = cornerAll;
  const cornerBottomLeft = cornerAll;
  const cornerBottomRight = cornerAll;

  return (
    <>
      {/* Backdrop that captures clicks outside the box to collapse it.
          Sits behind the box so the box itself and its rows remain
          interactive while the menu is open. */}
      <AnimatePresence>
        {expanded ? (
          <motion.div
            key="speed-dial-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={collapse}
            className="fixed inset-0 z-40 bg-black/30"
            aria-hidden
          />
        ) : null}
      </AnimatePresence>

      {/* The morph container. Anchored at right + bottom, so width/height
          changes push only the LEFT and TOP edges outward; the FAB at
          bottom-right stays put. `overflow-hidden` keeps the rows clipped
          during the morph so they don't poke past the rounded edge
          before the box gets there. */}
      <motion.div
        initial={false}
        animate={{
          width: boxWidth,
          height: boxHeight,
          borderTopLeftRadius: cornerTopLeft,
          borderTopRightRadius: cornerTopRight,
          borderBottomLeftRadius: cornerBottomLeft,
          borderBottomRightRadius: cornerBottomRight,
        }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        className="fixed z-50 overflow-hidden bg-primary shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
        style={{
          right: 24,
          bottom: "calc(76px + env(safe-area-inset-bottom) + 16px)",
          willChange: "width, height",
        }}
      >
        {/* 수입 추가 (top row, spans the full box width so the top-right
            isn't an empty L-step). Only rendered when expanded. */}
        <AnimatePresence>
          {expanded ? (
            <motion.button
              key="row-income"
              type="button"
              onClick={() => {
                collapse();
                setIncomeOpen(true);
              }}
              aria-label="수입 추가"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18, delay: 0.16 }}
              className="absolute left-0 right-0 top-0 flex items-end gap-2 text-primary-foreground"
              style={{
                height: ROW_H_TOP,
                paddingLeft: ROW_PAD_X,
                paddingRight: ROW_PAD_X,
                // Small breathing room from the row boundary so the icon
                // baseline doesn't touch the bottom row's icon directly.
                paddingBottom: 6,
                touchAction: "manipulation",
              }}
            >
              <Wallet className="size-5 shrink-0" aria-hidden />
              <span className="whitespace-nowrap text-[14px] font-semibold">
                수입 추가
              </span>
            </motion.button>
          ) : null}
        </AnimatePresence>

        {/* 소비 추가 (bottom row, left of the FAB). Only rendered when
            expanded. `right: FAB_COL` reserves the bottom-right square
            for the FAB. */}
        <AnimatePresence>
          {expanded ? (
            <motion.button
              key="row-spending"
              type="button"
              onClick={() => {
                collapse();
                setTransactionOpen(true);
              }}
              aria-label="소비 추가"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18, delay: 0.08 }}
              className="absolute bottom-0 flex items-center gap-2 text-primary-foreground"
              style={{
                right: FAB_COL,
                left: 0,
                height: ROW_H_BOTTOM,
                paddingLeft: ROW_PAD_X,
                paddingRight: ROW_PAD_X,
                touchAction: "manipulation",
              }}
            >
              <Receipt className="size-5 shrink-0" aria-hidden />
              <span className="whitespace-nowrap text-[14px] font-semibold">
                소비 추가
              </span>
            </motion.button>
          ) : null}
        </AnimatePresence>

        {/* FAB (+). Bottom-right corner, always rendered. Tracks
            long-press for menu expand; short tap behavior depends on
            whether the menu is open. `data-fab` lives on this stable
            56×56 button (not the morphing wrapper) so the onboarding
            guide measures a fixed rect regardless of the menu state. */}
        <button
          type="button"
          data-fab="add-transaction"
          aria-label="소비 추가. 길게 누르면 메뉴가 열려요."
          aria-expanded={expanded}
          onPointerDown={startPress}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={cancelPress}
          onPointerLeave={() => {
            // Drag-off cancels the gesture entirely (and suppresses the
            // synthetic tap that would otherwise fire when the pointer
            // returns to up state outside the button).
            if (timerRef.current != null) {
              cancelPress();
              triggeredRef.current = true;
            }
          }}
          // Block iOS Safari's native long-press context menu — it would
          // otherwise pop on the same hold gesture we're using to expand
          // the menu.
          onContextMenu={(event) => event.preventDefault()}
          // Pointer events drive open/close; suppress the synthetic click
          // so each interaction fires exactly one open.
          onClick={(event) => event.preventDefault()}
          style={{
            touchAction: "manipulation",
            WebkitTouchCallout: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
          className="absolute bottom-0 right-0 flex size-14 items-center justify-center text-primary-foreground"
        >
          <motion.span
            animate={{ rotate: expanded ? 45 : 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="inline-flex"
          >
            <Plus className="size-6" />
          </motion.span>
        </button>
      </motion.div>

      <TransactionFormDialog
        open={transactionOpen}
        onOpenChange={setTransactionOpen}
        categories={categories}
        groups={groups ?? []}
        defaultDate={defaultDate}
      />

      <IncomeFormDialog
        open={incomeOpen}
        onOpenChange={setIncomeOpen}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        defaultDate={incomeDefaultDate}
      />
    </>
  );
}
