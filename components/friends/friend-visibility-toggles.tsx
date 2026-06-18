"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { updateFriendVisibilityAction } from "@/app/friends/actions";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type FriendVisibilityPerms = {
  show_spending_total: boolean;
  show_spending_items: boolean;
  show_fixed_total: boolean;
  show_fixed_items: boolean;
  show_savings_total: boolean;
  show_savings_items: boolean;
};

type ToggleKey = keyof FriendVisibilityPerms;

// `dependsOn`: this row's switch is disabled (savings can't be shown) until the
// parent spending perm is on. Savings rides on top of the shared spending
// surface — the hero 모으기 line needs the spending-total card, and the calendar
// markers need the spending-items calendar to exist (Phase 2b §12.10).
const ROWS: {
  key: ToggleKey;
  label: string;
  helper?: string;
  dependsOn?: ToggleKey;
}[] = [
  {
    key: "show_spending_total",
    label: "총 소비 금액",
    helper: "이번 달 합계 숫자가 친구에게 보여요.",
  },
  {
    key: "show_spending_items",
    label: "소비 내역",
    helper: "각 소비의 카테고리·금액·메모가 친구에게 보여요.",
  },
  {
    key: "show_fixed_total",
    label: "고정지출 합계",
    helper: "월 고정지출 총액이 친구에게 보여요.",
  },
  {
    key: "show_fixed_items",
    label: "고정지출 항목",
    helper: "항목 이름이 친구에게 그대로 보여요.",
  },
  {
    key: "show_savings_total",
    label: "모은 돈 합계",
    helper: "매달 모으는 돈(적금·투자) 합계가 친구에게 보여요.",
    dependsOn: "show_spending_total",
  },
  {
    key: "show_savings_items",
    label: "모으기 적립일",
    helper: "달력에 적립일·항목 이름이 친구에게 보여요.",
    dependsOn: "show_spending_items",
  },
];

type Props = {
  friendUserId: string;
  initialPerms: FriendVisibilityPerms;
};

// Sheet-agnostic visibility toggle list. Renders inline anywhere — used by
// the per-friend detail page. Each row optimistically updates and rolls back
// on server failure (sonner toast).
export function FriendVisibilityToggles({ friendUserId, initialPerms }: Props) {
  const [perms, setPerms] = useState<FriendVisibilityPerms>(initialPerms);
  const [, startTransition] = useTransition();

  function flip(key: ToggleKey, next: boolean) {
    const prev = perms;
    setPerms({ ...perms, [key]: next });
    startTransition(async () => {
      const result = await updateFriendVisibilityAction(friendUserId, {
        [key]: next,
      });
      if (!result.ok) {
        setPerms(prev);
        toast.error(result.error);
      }
    });
  }

  return (
    <ul className="space-y-1">
      {ROWS.map((row) => {
        const value = perms[row.key];
        // Savings rows are locked off until their parent spending perm is on.
        const locked = row.dependsOn ? !perms[row.dependsOn] : false;
        return (
          <li
            key={row.key}
            className="flex items-start justify-between gap-3 rounded-2xl px-4 py-3"
          >
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              {value && !locked ? (
                <Eye
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden
                />
              ) : (
                <EyeOff
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[15px] font-medium leading-tight",
                    locked && "text-muted-foreground",
                  )}
                >
                  {row.label}
                </p>
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                  {locked ? "소비를 공개해야 켤 수 있어요." : row.helper}
                </p>
              </div>
            </div>
            <Switch
              checked={value && !locked}
              disabled={locked}
              onCheckedChange={(next) => flip(row.key, next)}
              aria-label={row.label}
            />
          </li>
        );
      })}
    </ul>
  );
}
