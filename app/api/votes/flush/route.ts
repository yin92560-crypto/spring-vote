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

type FlushResult = {
  ok: boolean;
  flushed?: number;
  skipped?: boolean;
  error?: string;
  details?: unknown;
};

async function runFlush(request: Request): Promise<NextResponse<FlushResult>> {
  try {
    const token = process.env.VOTE_SYNC_TOKEN?.trim();
    const authHeader = request.headers.get("x-vote-sync-token");
    const queryToken = new URL(request.url).searchParams.get("token");
    const sent = authHeader ?? queryToken;
    if (token) {
      if (sent !== token) {
        return NextResponse.json(
          {
            ok: false,
            error: "未授权",
            details: "请在 header x-vote-sync-token 或 ?token= 中提供 VOTE_SYNC_TOKEN",
          },
          { status: 401 }
        );
      }
    }

    const redis = getVoteRedis();
    const lock = await redis.set(keyFlushLock(), Date.now(), { nx: true, ex: 25 });
    if (lock !== "OK") {
      return NextResponse.json({ ok: true, skipped: true, details: "已有 flush 正在执行" });
    }

    const dirtyMembers = (await redis.smembers<string[]>(keyDirtyWorkDays())) ?? [];
    if (dirtyMembers.length === 0) {
      await redis.del(keyFlushLock());
      return NextResponse.json({ ok: true, flushed: 0, details: "没有待回写投票" });
    }

    const supabase = createAdminClient();
    let flushed = 0;
    const perWorkErrors: Array<{ member: string; reason: string }> = [];

    for (const member of dirtyMembers) {
      try {
        const parsed = parseWorkDayMember(member);
        if (!parsed) {
          perWorkErrors.push({ member, reason: "dirty member 格式非法" });
          continue;
        }
        const counterKey = keyWorkDayVotes(parsed.day, parsed.workId);
        const count = Number((await redis.get<number>(counterKey)) ?? 0);
        if (count <= 0) {
          await redis.srem(keyDirtyWorkDays(), member);
          continue;
        }

        const supabaseUrlPreview = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").slice(0, 15);
        console.log("[votes.flush] SUPABASE_URL preview:", supabaseUrlPreview);
        const { data: flushResult, error } = await supabase.rpc("apply_redis_vote_flush", {
          p_work_id: parsed.workId,
          p_vote_date: parsed.day,
          p_count: count,
        });
        if (error) {
          const msg = typeof error.message === "string" ? error.message : "rpc failed";
          console.error("flush votes failed:", parsed.workId, parsed.day, error);
          perWorkErrors.push({ member, reason: msg });
          continue;
        }
        const fr = flushResult as { ok?: boolean; reason?: string } | null;
        if (!fr?.ok) {
          const reason = typeof fr?.reason === "string" ? fr.reason : "apply_redis_vote_flush rejected";
          console.error("flush votes rpc not ok:", parsed.workId, parsed.day, flushResult);
          perWorkErrors.push({ member, reason });
          continue;
        }

        flushed += count;
        await redis.del(counterKey);
        await redis.srem(keyDirtyWorkDays(), member);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("flush votes unexpected member error:", member, err);
        perWorkErrors.push({ member, reason: msg });
      }
    }

    await redis.del(WORKS_LIST_CACHE_KEY);
    await redis.del(RANK_LIST_CACHE_KEY);
    await redis.del(keyFlushLock());
    return NextResponse.json({
      ok: true,
      flushed,
      details: {
        totalMembers: dirtyMembers.length,
        failedMembers: perWorkErrors.length,
        errors: perWorkErrors,
      },
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "服务器错误";
    return NextResponse.json({ ok: false, error: "服务器错误", details: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return runFlush(request);
}

export async function GET(request: Request) {
  try {
    return await runFlush(request);
  } catch (e) {
    const message = e instanceof Error ? e.message : "服务器错误";
    return NextResponse.json({ ok: false, error: "服务器错误", details: message }, { status: 500 });
  }
}
