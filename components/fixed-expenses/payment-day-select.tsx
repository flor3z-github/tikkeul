"use client";

import { ChevronDown } from "lucide-react";

import { PAYMENT_DAY_END_OF_MONTH } from "@/lib/utils/payment-day";

const UNSET_VALUE = "__unset__";
const EOM_VALUE = "__eom__";

type PaymentDaySelectProps = {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
};

/**
 * Dropdown for fixed_expenses.payment_day.
 *   - "미지정" → null
 *   - "말일"   → 0 (PAYMENT_DAY_END_OF_MONTH)
 *   - "N일"   → N (1..31)
 *
 * Uses a native <select> instead of base-ui Select because the catalog/manual/
 * active-item sheets are vaul drawers — base-ui's Select.Portal renders to
 * document.body and conflicts with the drawer's modal scrim, so the dropdown
 * pop-up never becomes interactive. Native <select> renders through the
 * platform picker (iOS wheel, Android drawer), which is also more familiar on
 * mobile for short numeric pickers.
 */
export function PaymentDaySelect({ id, value, onChange }: PaymentDaySelectProps) {
  const stringValue =
    value === null
      ? UNSET_VALUE
      : value === PAYMENT_DAY_END_OF_MONTH
        ? EOM_VALUE
        : String(value);

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (next === UNSET_VALUE) onChange(null);
    else if (next === EOM_VALUE) onChange(PAYMENT_DAY_END_OF_MONTH);
    else onChange(Number(next));
  }

  return (
    <div className="relative">
      <select
        id={id}
        value={stringValue}
        onChange={handleChange}
        className="h-12 w-full appearance-none rounded-2xl border border-border bg-card px-4 pr-10 text-[15px] outline-none focus:border-ring"
      >
        <option value={UNSET_VALUE}>미지정</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
          <option key={day} value={String(day)}>
            {day}일
          </option>
        ))}
        <option value={EOM_VALUE}>말일</option>
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
