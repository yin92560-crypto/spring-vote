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

export async function POST(request: Request) {
  try {
    const token = process.env.VOTE_SYNC_TOKEN?.trim();
    if (token) {
      const sent = request.headers.get("x-vote-sync-token");
      if (sent !== token) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
      }
    }

    const redis = getVoteRedis();
    const lock = await redis.set(keyFlushLock(), Date.now(), { nx: true, ex: 25 });
    if (lock !== "OK") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const dirtyMembers = (await redis.smembers<string[]>(keyDirtyWorkDays())) ?? [];
    if (dirtyMembers.length === 0) {
      await redis.del(keyFlushLock());
      return NextResponse.json({ ok: true, flushed: 0 });
    }

    const supabase = createAdminClient();
    let flushed = 0;

    for (const member of dirtyMembers) {
      const parsed = parseWorkDayMember(member);
      if (!parsed) continue;
      const counterKey = keyWorkDayVotes(parsed.day, parsed.workId);
      const count = Number((await redis.get<number>(counterKey)) ?? 0);
      if (count <= 0) {
        await redis.srem(keyDirtyWorkDays(), member);
        continue;
      }

      const rows = Array.from({ length: count }, () => ({
        work_id: parsed.workId,
        voter_ip: "redis-sync",
        vote_date: parsed.day,
      }));
      const supabaseUrlPreview = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").slice(0, 15);
      console.log("[votes.flush] SUPABASE_URL preview:", supabaseUrlPreview);
      console.log("[votes.flush] target table:", "votes");
      console.log("[votes.flush] insert payload:", rows);
      const { error } = await supabase.from("votes").insert(rows);
      if (error) {
        console.error("flush votes failed:", parsed.workId, parsed.day, error);
        continue;
      }

      flushed += count;
      await redis.del(counterKey);
      await redis.srem(keyDirtyWorkDays(), member);
    }

    await redis.del(WORKS_LIST_CACHE_KEY);
    await redis.del(RANK_LIST_CACHE_KEY);
    await redis.del(keyFlushLock());
    return NextResponse.json({ ok: true, flushed });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
