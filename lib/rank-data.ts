import { addDisplayNumbers } from "@/lib/work-display";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWorkImageUrl } from "@/lib/work-image-url";
import type { Work } from "@/lib/types";

/** 排行榜默认展示名次数量（减轻传输与前端渲染） */
export const RANK_LEADERBOARD_LIMIT = 61;

export async function fetchWorksRankedByVotes(): Promise<Work[]> {
  const supabase = createAdminClient();
  const { data: worksRows, error: worksErr } = await supabase
    .from("works")
    .select("*")
    .order("created_at", { ascending: false });
  if (worksErr) {
    console.error(worksErr);
    throw new Error("读取作品失败");
  }
  const works = Array.isArray(worksRows) ? worksRows : [];

  // 实时票数聚合（等价于 SELECT work_id, COUNT(*) FROM votes GROUP BY work_id）。
  const { data: votesRows, error: votesErr } = await supabase
    .from("votes")
    .select("work_id");
  if (votesErr) {
    console.error(votesErr);
    throw new Error("读取投票失败");
  }
  const validIds = new Set(works.map((w) => String((w as { id?: unknown }).id ?? "")));
  const voteCounts = new Map<string, number>();
  let unmatchedVoteRows = 0;
  for (const row of votesRows ?? []) {
    const workId = String((row as { work_id?: unknown }).work_id ?? "");
    if (!workId || !validIds.has(workId)) {
      unmatchedVoteRows += 1;
      continue;
    }
    voteCounts.set(workId, (voteCounts.get(workId) ?? 0) + 1);
  }
  if (unmatchedVoteRows > 0) {
    console.warn("rank votes without matching works.id:", unmatchedVoteRows);
  }

  const list = addDisplayNumbers(
    works.map((w) => ({
      id: String((w as { id?: unknown }).id ?? ""),
      title: String((w as { title?: unknown }).title ?? ""),
      workTitle: String((w as { work_title?: unknown; title?: unknown }).work_title ?? (w as { title?: unknown }).title ?? ""),
      authorName: String((w as { author_name?: unknown }).author_name ?? ""),
      imageUrl: normalizeWorkImageUrl(String((w as { image_url?: unknown }).image_url ?? "")),
      votes: voteCounts.get(String((w as { id?: unknown }).id ?? "")) ?? 0,
      createdAt: String((w as { created_at?: unknown }).created_at ?? ""),
    }))
  );

  const ranked = list.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  return ranked.slice(0, RANK_LEADERBOARD_LIMIT);
}
