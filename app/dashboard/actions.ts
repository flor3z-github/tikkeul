"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { TransactionVisibility } from "@/lib/queries/transactions";

export type TransactionActionResult =
  | { ok: true }
  | { ok: false; error: string };

type SubmitInput = {
  id?: string;
  amount: number;
  categoryId: string | null;
  spentAt: string; // ISO date or ISO datetime
  memo?: string | null;
  visibility?: TransactionVisibility;
  groupIds?: string[] | null;
};

const MEMO_MAX_LENGTH = 100;
const VALID_VISIBILITIES: TransactionVisibility[] = ["all", "groups", "private"];

function normalizeMemo(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeSpentAt(value: string): string {
  // Accept "YYYY-MM-DD" → "YYYY-MM-DDT00:00:00Z" so it lands at start of day UTC.
  // Skip the future check here: server TZ ≠ client TZ, and a same-day local
  // entry submitted early morning (KST) maps to a UTC midnight that may look
  // "future" relative to UTC now. Calendar UI already blocks future date pick.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00Z`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("올바른 날짜를 입력해주세요.");
  }
  // Full datetime carries a real instant — reject future.
  if (parsed.getTime() > Date.now()) {
    throw new Error("미래 시간은 기록할 수 없어요.");
  }
  return parsed.toISOString();
}

export async function submitTransactionAction(
  input: SubmitInput,
): Promise<TransactionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "금액은 0원보다 커야 해요." };
  }

  let spentAt: string;
  try {
    spentAt = normalizeSpentAt(input.spentAt);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "날짜 오류",
    };
  }

  const memo = normalizeMemo(input.memo);
  if (memo !== null && memo.length > MEMO_MAX_LENGTH) {
    return { ok: false, error: `메모는 ${MEMO_MAX_LENGTH}자까지 입력할 수 있어요.` };
  }

  const visibility: TransactionVisibility =
    input.visibility && VALID_VISIBILITIES.includes(input.visibility)
      ? input.visibility
      : "all";

  // visibility='groups' requires at least one group id, otherwise the row
  // would be hidden from everyone (equivalent to 'private' but tagged
  // 'groups'). Block at the server boundary so a tampered client can't sneak
  // it through.
  const groupIds =
    visibility === "groups"
      ? Array.from(
          new Set(
            (input.groupIds ?? []).filter(
              (id): id is string => typeof id === "string" && id.length > 0,
            ),
          ),
        )
      : [];
  if (visibility === "groups" && groupIds.length === 0) {
    return {
      ok: false,
      error: "공개할 그룹을 한 개 이상 선택해주세요.",
    };
  }

  if (input.id) {
    const { error } = await supabase.rpc("update_transaction_with_visibility", {
      p_id: input.id,
      p_amount: input.amount,
      p_category_id: input.categoryId,
      p_spent_at: spentAt,
      p_memo: memo,
      p_visibility: visibility,
      p_group_ids: groupIds.length > 0 ? groupIds : null,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const id = randomUUID();
    const { error } = await supabase.rpc("create_transaction_with_visibility", {
      p_id: id,
      p_amount: input.amount,
      p_category_id: input.categoryId,
      p_spent_at: spentAt,
      p_memo: memo,
      p_visibility: visibility,
      p_group_ids: groupIds.length > 0 ? groupIds : null,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export type SearchMemoResultItem = {
  id: string;
  amount: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  spent_at: string;
  memo: string;
};

export type SearchMemoActionResult =
  | { ok: true; items: SearchMemoResultItem[]; truncated: boolean }
  | { ok: false; error: string };

const SEARCH_LIMIT = 100;
const SEARCH_QUERY_MAX_LENGTH = 100;

// Escape SQL LIKE wildcards so a user-typed `%`/`_` is matched literally instead
// of acting as a pattern. The leading backslash escapes itself so a typed
// backslash still survives as a literal.
function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/[%_]/g, (m) => `\\${m}`);
}

export async function searchTransactionsByMemoAction(
  rawQuery: string,
): Promise<SearchMemoActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const query = (rawQuery ?? "").trim();
  if (query.length === 0) return { ok: true, items: [], truncated: false };
  if (query.length > SEARCH_QUERY_MAX_LENGTH) {
    return { ok: false, error: "검색어가 너무 길어요." };
  }

  const pattern = `%${escapeLikePattern(query)}%`;

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, amount, category_id, spent_at, memo, categories ( name, icon, color )",
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .not("memo", "is", null)
    .ilike("memo", pattern)
    .order("spent_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(SEARCH_LIMIT + 1);

  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as Array<{
    id: string;
    amount: number;
    category_id: string | null;
    spent_at: string;
    memo: string | null;
    categories: {
      name: string | null;
      icon: string | null;
      color: string | null;
    } | null;
  }>;

  const truncated = rows.length > SEARCH_LIMIT;
  const trimmed = truncated ? rows.slice(0, SEARCH_LIMIT) : rows;

  const items: SearchMemoResultItem[] = trimmed
    .filter((row): row is typeof row & { memo: string } => row.memo != null)
    .map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      category_id: row.category_id,
      category_name: row.categories?.name ?? null,
      category_icon: row.categories?.icon ?? null,
      category_color: row.categories?.color ?? null,
      spent_at: row.spent_at,
      memo: row.memo,
    }));

  return { ok: true, items, truncated };
}

export async function deleteTransactionAction(
  id: string,
): Promise<TransactionActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!id) return { ok: false, error: "삭제할 항목이 없어요." };

  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}
