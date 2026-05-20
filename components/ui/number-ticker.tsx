"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/money";

const SPRING: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 32,
  mass: 0.6,
};

type NumberTickerProps = {
  value: number;
  className?: string;
};

export function NumberTicker({ value, className }: NumberTickerProps) {
  const reduce = useReducedMotion();
  const chars = formatNumber(value).split("");
  const len = chars.length;

  if (reduce) {
    return (
      <span className={cn("tabular-nums", className)}>{chars.join("")}</span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-baseline tabular-nums", className)}
      style={{ lineHeight: 1 }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {chars.map((char, index) => {
          // Key by position from the right so a length change (e.g. 999 → 1,000)
          // adds/removes slots on the left while the existing digits keep rolling
          // in place instead of remounting.
          const positionFromRight = len - index;
          const isDigit = char >= "0" && char <= "9";
          const key = isDigit
            ? `d-${positionFromRight}`
            : `s-${positionFromRight}-${char}`;
          return (
            <motion.span
              key={key}
              layout
              initial={{ opacity: 0, y: "-40%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "40%" }}
              transition={SPRING}
              className="inline-block tabular-nums"
            >
              {isDigit ? <DigitColumn digit={Number(char)} /> : char}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </span>
  );
}

function DigitColumn({ digit }: { digit: number }) {
  return (
    <span
      className="relative inline-block overflow-hidden align-baseline tabular-nums"
      style={{ height: "1em", lineHeight: 1 }}
    >
      <span aria-hidden className="invisible">
        0
      </span>
      <motion.span
        className="absolute left-0 top-0 flex flex-col tabular-nums"
        initial={false}
        animate={{ y: `${-digit * 10}%` }}
        transition={SPRING}
        style={{ lineHeight: 1 }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="block" style={{ height: "1em" }}>
            {i}
          </span>
        ))}
      </motion.span>
    </span>
  );
}
