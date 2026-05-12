"use client";

import { X } from "lucide-react";

import { formatNumber, parseAmountInput } from "@/lib/utils/money";

type AmountInputProps = {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
};

/**
 * Big centered numeric input matching the transaction-form-dialog visual
 * style. Used in every fixed-expense bottom sheet for amount entry.
 */
export function AmountInput({ value, onChange, autoFocus }: AmountInputProps) {
  const parsed = parseAmountInput(value);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    onChange(formatNumber(parseAmountInput(event.target.value)));
  }

  return (
    <div className="relative rounded-2xl bg-muted px-4 py-6">
      {parsed > 0 ? (
        <button
          type="button"
          aria-label="금액 지우기"
          onClick={() => onChange("")}
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground transition-colors hover:bg-background active:scale-[0.96]"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
      <div className="flex items-baseline justify-center gap-2">
        <input
          inputMode="numeric"
          autoFocus={autoFocus}
          value={value}
          onChange={handleChange}
          placeholder="0"
          className="min-w-[1ch] bg-transparent text-right text-[40px] font-bold tracking-[-0.045em] tabular-nums outline-none [field-sizing:content]"
        />
        <span className="text-[22px] font-semibold text-muted-foreground">
          원
        </span>
      </div>
    </div>
  );
}
