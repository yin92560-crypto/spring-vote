import type { SupabaseClient } from "@supabase/supabase-js";

/** 与 PostgREST / works 表一致的公开列（snake_case） */
export const WORKS_SELECT_WITH_VOTES_COUNT =
  "id, title, work_title, author_name, image_url, created_at, votes_count" as const;

export const WORKS_SELECT_WITHOUT_VOTES_COUNT =
  "id, title, work_title, author_name, image_url, created_at" as const;

export type WorksListRow = {
  id: string;
  title: string;
  work_title?: string | null;
  author_name?: string | null;
  image_url: string;
  created_at: string;
  votes_count?: number | null;
};

export function isMissingVotesCountColumnError(err: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!err?.message) return false;
  const msg = err.message.toLowerCase();
  const code = String(err.code ?? "");
  return (
    code === "42703" ||
    msg.includes("votes_count") ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
}

export function votesFromRow(row: WorksListRow, usedFallbackSelect: boolean): number {
  if (usedFallbackSelect) return 0;
  return Number(row.votes_count ?? 0);
}

/**
 * 全量作品列表（无关键词过滤）。若库中尚无 votes_count 列，则自动降级查询，避免整站 500。
 */
export async function fetchWorksTableAll(
  supabase: SupabaseClient
): Promise<{ rows: WorksListRow[]; usedVotesCountFallback: boolean }> {
  let usedFallback = false;
  let data: WorksListRow[] | null = null;
  let { data: rowData, error } = await supabase
    .from("works")
    .select(WORKS_SELECT_WITH_VOTES_COUNT)
    .order("created_at", { ascending: false });
  data = rowData as WorksListRow[] | null;

  if (error && isMissingVotesCountColumnError(error)) {
    console.warn("[fetchWorksTableAll] votes_count missing, retrying without column");
    usedFallback = true;
    const r2 = await supabase
      .from("works")
      .select(WORKS_SELECT_WITHOUT_VOTES_COUNT)
      .order("created_at", { ascending: false });
    data = r2.data as WorksListRow[] | null;
    error = r2.error;
  }

  if (error) {
    console.error("[fetchWorksTableAll]", error);
    throw error;
  }

  return { rows: (data ?? []) as WorksListRow[], usedVotesCountFallback: usedFallback };
}

/**
 * 带 .or(...) 条件的作品查询（如搜索）；同样支持 votes_count 缺失时降级。
 */
export async function fetchWorksTableWithOr(
  supabase: SupabaseClient,
  orFilter: string,
  options: { limit?: number } = {}
): Promise<{ rows: WorksListRow[]; usedVotesCountFallback: boolean }> {
  let usedFallback = false;
  const limit = options.limit;

  let q = supabase
    .from("works")
    .select(WORKS_SELECT_WITH_VOTES_COUNT)
    .or(orFilter)
    .order("created_at", { ascending: false });
  if (typeof limit === "number") q = q.limit(limit);
  let data: WorksListRow[] | null = null;
  let { data: rowData, error } = await q;
  data = rowData as WorksListRow[] | null;

  if (error && isMissingVotesCountColumnError(error)) {
    console.warn("[fetchWorksTableWithOr] votes_count missing, retrying without column");
    usedFallback = true;
    let q2 = supabase
      .from("works")
      .select(WORKS_SELECT_WITHOUT_VOTES_COUNT)
      .or(orFilter)
      .order("created_at", { ascending: false });
    if (typeof limit === "number") q2 = q2.limit(limit);
    const r2 = await q2;
    data = r2.data as WorksListRow[] | null;
    error = r2.error;
  }

  if (error) {
    console.error("[fetchWorksTableWithOr]", error);
    throw error;
  }

  return { rows: (data ?? []) as WorksListRow[], usedVotesCountFallback: usedFallback };
}
