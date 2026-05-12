import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { TransactionFormCategory } from "@/components/transactions/transaction-form-dialog";

const CATEGORY_ORDER = ["식비", "카페", "교통", "쇼핑", "생활", "의료", "기타"];
const HIDDEN_CATEGORIES = new Set(["구독"]);

function categoryRank(name: string): number {
  const index = CATEGORY_ORDER.indexOf(name);
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
      .select("id, name, icon, user_id")
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order("created_at", { ascending: true });

    if (error) return { ok: false, error: error.message };

    const categories: TransactionFormCategory[] = (data ?? [])
      .filter((row) => !HIDDEN_CATEGORIES.has(row.name))
      .sort((a, b) => categoryRank(a.name) - categoryRank(b.name))
      .map((row) => ({ id: row.id, name: row.name, icon: row.icon }));

    return { ok: true, categories };
  },
);
