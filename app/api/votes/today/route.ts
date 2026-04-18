import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DAILY_VOTE_LIMIT } from "@/lib/vote-config";
import { fetchTodayVoterUsageFromDb } from "@/lib/today-voter-usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 仅查询 public.votes：当前 voter_id（x-voter-id）在上海当日的已投作品数。
 * 只读，不写库。
 */
export async function GET(request: Request) {
  try {
    const headerVoterId = request.headers.get("x-voter-id")?.trim() ?? "";
    const voterId = UUID_RE.test(headerVoterId) ? headerVoterId : "";

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    if (!voterId) {
      return NextResponse.json({
        used: 0,
        remaining: DAILY_VOTE_LIMIT,
        dailyVoteLimit: DAILY_VOTE_LIMIT,
        votedWorkIds: [] as string[],
      });
    }

    const supabase = createAdminClient();
    const { usedDistinctWorks, votedWorkIds } = await fetchTodayVoterUsageFromDb(
      supabase,
      voterId,
      today
    );
    const remaining = Math.max(0, DAILY_VOTE_LIMIT - usedDistinctWorks);

    return NextResponse.json({
      used: usedDistinctWorks,
      remaining,
      dailyVoteLimit: DAILY_VOTE_LIMIT,
      votedWorkIds,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
