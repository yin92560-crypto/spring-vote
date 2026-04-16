import { addDisplayNumbers } from "@/lib/work-display";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeWorkImageUrl } from "@/lib/work-image-url";
import {
  getVoteRedis,
  keyDirtyWorkDays,
  keyWorkDayVotes,
  parseWorkDayMember,
} from "@/lib/vote-redis";
import type { Work } from "@/lib/types";

const RANK_LIST_CACHE_KEY = "rank:list:v1";

/**
 * 读取全部作品与实时票数（与 /api/works 一致），按票数降序排列；
 * 票数相同时按提交时间升序（编号更小者优先）。
 */
export async function fetchWorksRankedByVotes(): Promise<Work[]> {
  const redis = getVoteRedis();
  let list: Work[] | null = null;
    try {
      const cached = await redis.get<string>(RANK_LIST_CACHE_KEY);
      if (typeof cached === "string" && cached) {
        const parsed = JSON.parse(cached) as Work[];
        list = parsed.map((w) => ({
          ...w,
          imageUrl: normalizeWorkImageUrl(w.imageUrl),
        }));
      }
  } catch (cacheErr) {
    console.error("read rank cache failed:", cacheErr);
  }

  if (!list) {
    const supabase = createAdminClient();
    const { data: works, error: wErr } = await supabase
      .from("works")
      .select("id, title, work_title, author_name, image_url, created_at")
      .order("created_at", { ascending: false });

    if (wErr) {
      console.error(wErr);
      throw new Error("读取作品失败");
    }

    const { data: voteRows, error: vErr } = await supabase
      .from("votes")
      .select("work_id");

    if (vErr) {
      console.error(vErr);
      throw new Error("读取票数失败");
    }

    const counts = new Map<string, number>();
    for (const row of voteRows ?? []) {
      const wid = row.work_id as string;
      counts.set(wid, (counts.get(wid) ?? 0) + 1);
    }

    list = addDisplayNumbers(
      (works ?? []).map((w) => ({
        id: w.id as string,
        title: w.title as string,
        workTitle: (w.work_title as string | null) ?? (w.title as string),
        authorName: (w.author_name as string | null) ?? "",
        imageUrl: normalizeWorkImageUrl(w.image_url as string),
        votes: counts.get(w.id as string) ?? 0,
        createdAt: w.created_at as string,
      }))
    );
    try {
      await redis.set(RANK_LIST_CACHE_KEY, JSON.stringify(list), { ex: 60 });
    } catch (cacheErr) {
      console.error("write rank cache failed:", cacheErr);
    }
  }

  // 叠加 Redis 未回写增量，保证榜单接近实时
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
  return ranked.slice(0, 50);
}
  