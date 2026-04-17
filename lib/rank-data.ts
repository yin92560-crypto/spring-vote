import { addDisplayNumbers } from "@/lib/work-display";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchWorksTableAll,
  votesFromRow,
} from "@/lib/supabase-works-columns";
import { normalizeWorkImageUrl } from "@/lib/work-image-url";
import {
  getVoteRedis,
  keyDirtyWorkDays,
  keyWorkDayVotes,
  parseWorkDayMember,
} from "@/lib/vote-redis";
import type { Work } from "@/lib/types";

/** 排行榜默认展示名次数量（减轻传输与前端渲染） */
export const RANK_LEADERBOARD_LIMIT = 61;

/**
 * 读取作品与实时票数：以 works 表上汇总列（优先 votes_count，兼容 votes）为已落库票数，
 * 再叠加 Redis 中尚未 flush 的增量；按票数降序，平票按创建时间升序；默认只返回前 {@link RANK_LEADERBOARD_LIMIT} 名。
 */
export async function fetchWorksRankedByVotes(): Promise<Work[]> {
  const supabase = createAdminClient();
  let workRows;
  let tallyColumn;
  try {
    const r = await fetchWorksTableAll(supabase);
    workRows = r.rows;
    tallyColumn = r.tallyColumn;
  } catch (wErr) {
    console.error(wErr);
    throw new Error("读取作品失败");
  }

  const list = addDisplayNumbers(
    workRows.map((w) => ({
      id: w.id as string,
      title: w.title as string,
      workTitle: (w.work_title as string | null) ?? (w.title as string),
      authorName: (w.author_name as string | null) ?? "",
      imageUrl: normalizeWorkImageUrl(w.image_url as string),
      votes: votesFromRow(w, tallyColumn),
      createdAt: w.created_at as string,
    }))
  );

  const redis = getVoteRedis();
  try {
    const dirtyMembers = (await redis.smembers<string[]>(keyDirtyWorkDays())) ?? [];
    for (const member of dirtyMembers) {
      const parsed = parseWorkDayMember(member);
      if (!parsed) continue;
      const n = Number(
        (await redis.get<number>(keyWorkDayVotes(parsed.day, parsed.workId))) ?? 0
      );
      if (n <= 0) continue;
      const target = list.find((w) => w.id === parsed.workId);
      if (target) target.votes += n;
    }
  } catch (redisErr) {
    console.error("read redis vote delta for rank failed:", redisErr);
  }

  const ranked = list.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  return ranked.slice(0, RANK_LEADERBOARD_LIMIT);
}
