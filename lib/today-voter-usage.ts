import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 今日投票：核心等价于
 * `from('votes').select('*').eq('vote_date', today).eq('voter_ip', local_uuid)`
 * 再合并 `voter_client_id` 同 UUID，避免漏计；按 work_id 去重得到「已投作品数」。
 */
export async function fetchTodayVoterUsageFromDb(
  supabase: SupabaseClient,
  /** localStorage voter_id（UUID） */
  voterUuid: string,
  /** YYYY-MM-DD（Asia/Shanghai） */
  voteDate: string
): Promise<{ usedDistinctWorks: number; votedWorkIds: string[] }> {
  const [byIp, byClient] = await Promise.all([
    supabase
      .from("votes")
      .select("*")
      .eq("vote_date", voteDate)
      .eq("voter_ip", voterUuid),
    supabase
      .from("votes")
      .select("*")
      .eq("vote_date", voteDate)
      .eq("voter_client_id", voterUuid),
  ]);

  if (byIp.error) {
    console.error("fetchTodayVoterUsageFromDb (voter_ip):", byIp.error);
  }
  if (byClient.error) {
    console.error("fetchTodayVoterUsageFromDb (voter_client_id):", byClient.error);
  }
  if (byIp.error && byClient.error) {
    return { usedDistinctWorks: 0, votedWorkIds: [] };
  }

  const set = new Set<string>();
  for (const row of [...(byIp.data ?? []), ...(byClient.data ?? [])]) {
    const id = row.work_id as string | undefined;
    if (id) set.add(id);
  }
  const votedWorkIds = [...set];
  return { usedDistinctWorks: votedWorkIds.length, votedWorkIds };
}
