import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `public.works` 上「该作品总票数」的物理列名（与 `public.votes` 投票明细表区分）。
 * 标准名为 `votes_count`；若历史库把汇总存在 `works.votes` 上，查询会按序自动降级。
 */
export const WORKS_TALLY_COLUMN_PREFERRED = "votes_count" as const;
export const WORKS_TALLY_COLUMN_LEGACY = "votes" as const;

const WORKS_BASE_SELECT =
  "id, title, work_title, author_name, image_url, created_at" as const;

export type WorksTallyColumn = typeof WORKS_TALLY_COLUMN_PREFERRED | typeof WORKS_TALLY_COLUMN_LEGACY;

export type WorksListRow = {
  id: string;
  title: string;
  work_title?: string | null;
  author_name?: string | null;
  image_url: string;
  created_at: string;
  votes_count?: number | null;
  /** 仅当 DB 使用 works.votes 作为汇总列时由 PostgREST 返回 */
  votes?: number | null;
};

function selectListWithTally(tally: WorksTallyColumn | null): string {
  return tally ? `${WORKS_BASE_SELECT}, ${tally}` : WORKS_BASE_SELECT;
}

/** PostgREST / Postgres：列不存在等 */
function isUndefinedColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (String(err.code) === "42703") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("does not exist") && m.includes("column");
}

export function votesFromRow(row: WorksListRow, tallyColumn: WorksTallyColumn | null): number {
  if (!tallyColumn) return 0;
  if (tallyColumn === WORKS_TALLY_COLUMN_LEGACY) return Number(row.votes ?? 0);
  return Number(row.votes_count ?? 0);
}

async function fetchWorksRowsWithTally(
  supabase: SupabaseClient,
  run: (selectList: string) => Promise<{
    data: unknown[] | null;
    error: { code?: string; message?: string } | null;
  }>
): Promise<{ rows: WorksListRow[]; tallyColumn: WorksTallyColumn | null }> {
  const attempts: Array<WorksTallyColumn | null> = [
    WORKS_TALLY_COLUMN_PREFERRED,
    WORKS_TALLY_COLUMN_LEGACY,
    null,
  ];
  let lastErr: { code?: string; message?: string } | null = null;
  for (const tally of attempts) {
    const { data, error } = await run(selectListWithTally(tally));
    if (!error) {
      return { rows: (data ?? []) as WorksListRow[], tallyColumn: tally };
    }
    lastErr = error;
    if (tally !== null && isUndefinedColumnError(error)) continue;
    break;
  }
  console.error("[fetchWorksRowsWithTally]", lastErr);
  throw lastErr ?? new Error("读取作品失败");
}

/**
 * 全量作品列表（无 where 过滤）。自动匹配 `works.votes_count` 或 `works.votes` 汇总列。
 */
export async function fetchWorksTableAll(
  supabase: SupabaseClient
): Promise<{ rows: WorksListRow[]; tallyColumn: WorksTallyColumn | null }> {
  return fetchWorksRowsWithTally(supabase, async (cols) =>
    supabase.from("works").select(cols).order("created_at", { ascending: false })
  );
}

/**
 * 带 .or(...) 条件的作品查询（如搜索）。
 */
export async function fetchWorksTableWithOr(
  supabase: SupabaseClient,
  orFilter: string,
  options: { limit?: number } = {}
): Promise<{ rows: WorksListRow[]; tallyColumn: WorksTallyColumn | null }> {
  const limit = options.limit;
  return fetchWorksRowsWithTally(supabase, async (cols) => {
    let q = supabase
      .from("works")
      .select(cols)
      .or(orFilter)
      .order("created_at", { ascending: false });
    if (typeof limit === "number") q = q.limit(limit);
    return q;
  });
}
