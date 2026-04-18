import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 按 voter_client_id + 上海自然日统计：今日已投过的不同作品数及作品 id 列表。
 */
export async function fetchTodayVoterUsageFromDb(
  supabase: SupabaseClient,
  voterId: string,
  /** YYYY-MM-DD（Asia/Shanghai） */
  voteDate: string
): Promise<{ usedDistinctWorks: number; votedWorkIds: string[] }> {
  const { data, error } = await supabase
    .from("votes")
    .select("work_id")
    .eq("voter_client_id", voterId)
    .eq("vote_date", voteDate);

  if (error) {
    console.error("fetchTodayVoterUsageFromDb:", error);
    return { usedDistinctWorks: 0, votedWorkIds: [] };
  }
  const set = new Set<string>();
  for (const row of data ?? []) {
    const id = row.work_id as string | undefined;
    if (id) set.add(id);
  }
  const votedWorkIds = [...set];
  return { usedDistinctWorks: votedWorkIds.length, votedWorkIds };
}
