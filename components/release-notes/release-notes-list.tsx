"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";

import {
  RELEASE_ITEM_TYPE_LABEL,
  type ReleaseItemType,
  type ReleaseNote,
} from "@/lib/release-notes";
import { cn } from "@/lib/utils";

// Disclosure expand/collapse duration (ms). Shared by the height animation and
// the post-expand auto-scroll so they stay in sync.
const EXPAND_MS = 280;

/** Nearest scrollable ancestor (the sheet's inner overflow-y-auto scroller). */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if (oy === "auto" || oy === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

// Tag-chip styling per item type. Built only from semantic tokens (primary /
// secondary / muted / border) + opacity so it tracks the theme — no ad-hoc
// colors. `fix` is an outline chip (not destructive-red) so it reads as
// "we fixed it", not "error". Fixed width so the chip column aligns and the
// content text starts at the same x across every row.
const TYPE_CHIP_CLASS: Record<ReleaseItemType, string> = {
  feature: "bg-primary/12 text-primary",
  improve: "bg-secondary text-secondary-foreground",
  design: "bg-muted text-muted-foreground",
  fix: "border border-border text-muted-foreground",
};

function TypeChip({ type }: { type: ReleaseItemType }) {
  return (
    <span
      className={cn(
        // h-[18px] matches the content's leading-[18px] so the chip and the
        // first line of text share a top edge (perfectly parallel). w-14 +
        // justify-center makes every chip the same width regardless of label.
        "inline-flex h-[18px] w-14 shrink-0 items-center justify-center whitespace-nowrap rounded-full text-[11px] font-medium leading-none",
        TYPE_CHIP_CLASS[type],
      )}
    >
      {RELEASE_ITEM_TYPE_LABEL[type]}
    </span>
  );
}

/**
 * Collapsible list of release notes shared by both surfaces: the settings
 * "새 소식" sheet (all RELEASE_NOTES) and the dashboard one-time popup (latest
 * only). Each version is a disclosure; the latest (first) is expanded by
 * default, the rest collapsed — tap a header to toggle.
 */
export function ReleaseNotesList({ notes }: { notes: ReleaseNote[] }) {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(notes[0] ? [notes[0].version] : []),
  );
  // Per-version section refs so we can scroll a freshly-opened version to the
  // top of the scroller — in the fixed-height settings sheet a bottom version's
  // expanded body otherwise opens below the fold with no cue that it opened.
  const sectionRefs = useRef<Map<string, HTMLElement | null>>(new Map());

  function toggle(version: string) {
    const willOpen = !open.has(version);
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
    if (willOpen) {
      // Reveal the opened body ONLY if it spills below the fold — don't yank
      // the view just because total height grew. Wait for the expand animation
      // to finish (height 0 → auto) so layout is final, then scroll the minimum
      // needed: if the section is taller than the viewport bring its top up;
      // otherwise nudge just enough for its bottom to clear the fold.
      window.setTimeout(() => {
        const section = sectionRefs.current.get(version);
        const scroller = getScrollParent(section ?? null);
        if (!section || !scroller) return;
        const s = section.getBoundingClientRect();
        const c = scroller.getBoundingClientRect();
        if (s.bottom <= c.bottom) return; // already fully visible — stay put
        const delta =
          s.height >= c.height ? s.top - c.top : s.bottom - c.bottom;
        scroller.scrollBy({ top: delta, behavior: "smooth" });
      }, EXPAND_MS + 40);
    }
  }

  return (
    <div className="divide-y divide-border">
      {notes.map((note) => {
        const isOpen = open.has(note.version);
        return (
          <section
            key={note.version}
            ref={(el) => {
              sectionRefs.current.set(note.version, el);
            }}
            className="py-4 first:pt-0"
          >
            <button
              type="button"
              onClick={() => toggle(note.version)}
              aria-expanded={isOpen}
              // items-center vertically centers the version + chevron against
              // the stacked title/date block on the left.
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-bold tracking-[-0.02em]">
                  {note.title}
                </span>
                <span className="mt-0.5 block text-[12px] tabular-nums text-muted-foreground">
                  {note.date.replace(/-/g, ".")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                <span className="text-[12px] tabular-nums">
                  v{note.version}
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "size-4 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </span>
            </button>

            {/* initial={false} so the default-open latest version doesn't
                play an entrance animation on first mount — only user toggles
                animate. overflow-hidden clips the body while height collapses;
                spacing lives on the inner pt-3 (inside the measured content)
                so it animates with the height instead of leaving a gap. */}
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: EXPAND_MS / 1000, ease: [0.32, 0.72, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-3">
                    {note.summary ? (
                      <p className="mb-3 text-[13px] text-muted-foreground">
                        {note.summary}
                      </p>
                    ) : null}
                    <ul className="space-y-2">
                      {note.items.map((item, index) => (
                        <li key={index} className="flex items-start gap-2.5">
                          <TypeChip type={item.type} />
                          <span className="text-[13px] leading-[18px] text-foreground/85">
                            {item.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}
