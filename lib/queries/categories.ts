import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { TransactionFormCategory } from "@/components/transactions/transaction-form-dialog";

const CATEGORY_ORDER = [
  "식비",
  "카페/간식",
  "술/유흥",
  "쇼핑",
  "교통/자동차",
  "주거/통신",
  "의료/건강",
  "문화/여가",
  "여행/숙박",
  "경조/선물",
  "데이트",
  "기타",
];
const HIDDEN_CATEGORIES = new Set(["구독"]);

// Rank keyed on seed-vs-custom, not on name. Customs always sort AFTER every
// seed (including 기타, the last seed) regardless of their name — a user may
// legitimately create a custom named identically to a seed (the unique index
// is per (user_id, name), and seeds are NULL user_id), so we must not let a
// custom borrow a seed's order slot by name match. Seeds use their
// CATEGORY_ORDER index; an unlisted seed (shouldn't happen) falls just before
// customs. The query is ordered by created_at asc and Array.prototype.sort is
// stable, so customs preserve creation order among themselves.
const CUSTOM_RANK_BASE = CATEGORY_ORDER.length + 1; // strictly after all seeds

function categoryRank(row: { name: string; user_id: string | null }): number {
  if (row.user_id !== null) return CUSTOM_RANK_BASE; // custom → after all seeds
  const index = CATEGORY_ORDER.indexOf(row.name);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export type GetCategoriesResult =
  | { ok: true; categories: TransactionFormCategory[] }
  | { ok: false; error: string };

// React `cache()` dedups within a single request — two sections calling
// `getCategories(userId)` issue one Supabase query, not two.
export const getCategories = cache(
  async (userId: string): Promise<GetCategoriesResult> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, icon, color, user_id")
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order("created_at", { ascending: true });

    if (error) return { ok: false, error: error.message };

    const categories: TransactionFormCategory[] = (data ?? [])
      .filter((row) => !HIDDEN_CATEGORIES.has(row.name))
      .sort((a, b) => categoryRank(a) - categoryRank(b))
      .map((row) => ({
        id: row.id,
        name: row.name,
        icon: row.icon,
        color: row.color,
        isCustom: row.user_id !== null,
      }));

    return { ok: true, categories };
  },
);
