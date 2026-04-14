import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getVoteRedis,
  keyDirtyWorkDays,
  keyFlushLock,
  keyWorkDayVotes,
  parseWorkDayMember,
} from "@/lib/vote-redis";

export const dynamic = "force-dynamic";
const WORKS_LIST_CACHE_KEY = "works:list:v1";
const RANK_LIST_CACHE_KEY = "rank:list:v1";

/** 清空全部投票记录（管理用）。若设置了 ADMIN_SECRET，需在请求头 x-admin-secret 中携带。 */
export async function POST(request: Request) {
  try {
    const secret = process.env.ADMIN_SECRET;
    if (secret) {
      const sent = request.headers.get("x-admin-secret");
      if (sent !== secret) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
      }
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("votes")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "清空失败" }, { status: 500 });
    }

    // 清理 Redis 投票缓存，避免清零后旧缓存再次回写。
    try {
      const redis = getVoteRedis();
      const dirtyMembers = (await redis.smembers<string[]>(keyDirtyWorkDays())) ?? [];
      for (const member of dirtyMembers) {
        const parsed = parseWorkDayMember(member);
        if (!parsed) continue;
        await redis.del(keyWorkDayVotes(parsed.day, parsed.workId));
      }
      await redis.del(keyDirtyWorkDays());
      await redis.del(keyFlushLock());
      await redis.del("vote:sync:ops");
      await redis.del(WORKS_LIST_CACHE_KEY);
      await redis.del(RANK_LIST_CACHE_KEY);
    } catch (redisErr) {
      console.error("clear redis vote cache failed:", redisErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
