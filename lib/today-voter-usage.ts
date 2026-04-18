import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 今日投票记录：按浏览器 UUID 匹配 `voter_client_id` 或 `voter_ip`（历史数据可能把 UUID 写在 voter_ip），
 * 等价于前端预检 `.select('*').eq(...)` 后按当日去重作品数。
 */
export async function fetchTodayVoterUsageFromDb(
  supabase: SupabaseClient,
  /** localStorage voter_id（UUID）；与 voter_ip 列交叉匹配以兼容历史数据 */
  voterUuid: string,
  /** YYYY-MM-DD（Asia/Shanghai） */
  voteDate: string
): Promise<{ usedDistinctWorks: number; votedWorkIds: string[] }> {
  const [byClient, byIp] = await Promise.all([
    supabase
      .from("votes")
      .select("*")
      .eq("vote_date", voteDate)
      .eq("voter_client_id", voterUuid),
    supabase
      .from("votes")
      .select("*")
      .eq("vote_date", voteDate)
      .eq("voter_ip", voterUuid),
  ]);

  if (byClient.error) {
    console.error("fetchTodayVoterUsageFromDb (voter_client_id):", byClient.error);
  }
  if (byIp.error) {
    console.error("fetchTodayVoterUsageFromDb (voter_ip):", byIp.error);
  }
  if (byClient.error && byIp.error) {
    return { usedDistinctWorks: 0, votedWorkIds: [] };
  }

  const set = new Set<string>();
  for (const row of [...(byClient.data ?? []), ...(byIp.data ?? [])]) {
    const id = row.work_id as string | undefined;
    if (id) set.add(id);
  }
  const votedWorkIds = [...set];
  return { usedDistinctWorks: votedWorkIds.length, votedWorkIds };
}
