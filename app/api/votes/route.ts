import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/get-client-ip";
import {
  getVoteRedis,
  keyDailyUserVotes,
  keyDailyUserWorkLock,
  keyDirtyWorkDays,
  keyWorkDayVotes,
  todayInShanghai,
  triggerVotesFlush,
  voteUserKey,
  workDayMember,
} from "@/lib/vote-redis";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const DAILY_LIMIT = 3;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    let body: { workId?: string; voterId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "无效请求" }, { status: 400 });
    }

    const workId = body.workId;
    if (!workId || typeof workId !== "string") {
      return NextResponse.json({ error: "缺少作品 id" }, { status: 400 });
    }

    const incomingVoterId = String(body.voterId ?? "").trim();
    const voterId = UUID_RE.test(incomingVoterId) ? incomingVoterId : "";

    const ip = getClientIp(request.headers);
    const ua = request.headers.get("user-agent") ?? "";
    const day = todayInShanghai();
    // 优先使用浏览器持久 voterId，IP 仅作为旧客户端兼容兜底。
    const userKey = voterId || voteUserKey(ip, ua);
    const redis = getVoteRedis();

    const lockKey = keyDailyUserWorkLock(day, userKey, workId);
    const lockOk = await redis.set(lockKey, "1", { nx: true, ex: 86400 });
    if (lockOk !== "OK") {
      return NextResponse.json({
        ok: false,
        reason: "同一作品今日仅可投一次",
      });
    }

    const dailyKey = keyDailyUserVotes(day, userKey);
    const dailyCount = await redis.incr(dailyKey);
    if (dailyCount === 1) {
      await redis.expire(dailyKey, 86400);
    }
    if (dailyCount > DAILY_LIMIT) {
      await redis.decr(dailyKey);
      await redis.del(lockKey);
      return NextResponse.json({
        ok: false,
        reason: "今日票数已用完",
      });
    }

    const workDayKey = keyWorkDayVotes(day, workId);
    const latestVotes = await redis.incr(workDayKey);
    if (latestVotes === 1) {
      await redis.expire(workDayKey, 7 * 86400);
    }
    await redis.sadd(keyDirtyWorkDays(), workDayMember(day, workId));

    // 触发条件：每累计 20 次投票尝试异步回写一次 Supabase
    const ops = await redis.incr("vote:sync:ops");
    if (ops % 20 === 0) {
      const baseUrl = new URL(request.url).origin;
      void triggerVotesFlush(baseUrl).catch((err) => {
        console.error("triggerVotesFlush failed:", err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
