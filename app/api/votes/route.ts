import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/get-client-ip";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CastVoteResult = { ok?: boolean; reason?: string };

type VoteBody = {
  p_work_id?: string;
  workId?: string;
  voterId?: string;
  voter_id?: string;
  /** 历史：部分客户端把浏览器 UUID 放在 voter_ip 字段 */
  voter_ip?: string;
  p_voter_ip?: string;
};

export async function POST(request: Request) {
  try {
    let body: VoteBody;
    try {
      body = (await request.json()) as VoteBody;
    } catch {
      return NextResponse.json({ error: "无效请求" }, { status: 400 });
    }

    /** p_work_id：标准 UUID（作品 id） */
    const rawWorkId = String(body.p_work_id ?? body.workId ?? "").trim();
    const p_work_id = rawWorkId.toLowerCase();
    if (!p_work_id || !UUID_RE.test(p_work_id)) {
      return NextResponse.json({ error: "缺少或无效的作品 id" }, { status: 400 });
    }

    /** p_voter_id：浏览器 localStorage 的 UUID（勿与真实 IP 混淆） */
    const uuidPrimary = String(body.voterId ?? body.voter_id ?? "").trim();
    const uuidLegacy = String(body.voter_ip ?? "").trim();
    const p_voter_id = UUID_RE.test(uuidPrimary)
      ? uuidPrimary
      : UUID_RE.test(uuidLegacy)
        ? uuidLegacy
        : "";

    /** p_voter_ip：用户真实 IP（写入 votes.voter_ip 列） */
    const headerIp = getClientIp(request.headers);
    const p_voter_ip =
      (typeof headerIp === "string" && headerIp.trim() !== ""
        ? headerIp.trim()
        : null) ?? "unknown";

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const supabase = createAdminClient();

    // 1) 校验作品存在
    const { data: workRow, error: workErr } = await supabase
      .from("works")
      .select("id")
      .eq("id", p_work_id)
      .maybeSingle();
    if (workErr) {
      console.error("votes.route work check failed:", workErr);
      return NextResponse.json({ error: "投票失败，请稍后重试" }, { status: 500 });
    }
    if (!workRow) {
      return NextResponse.json({ ok: false, reason: "作品不存在" }, { status: 200 });
    }

    // 2) 今日查票（优先 voter_client_id，兼容按 voter_ip 记 UUID 的历史数据）
    const byClientPromise = p_voter_id
      ? supabase
          .from("votes")
          .select("work_id")
          .eq("vote_date", today)
          .eq("voter_client_id", p_voter_id)
      : Promise.resolve({ data: [], error: null } as {
          data: Array<{ work_id: string }> | null;
          error: null;
        });

    const byIpPromise = p_voter_id
      ? supabase
          .from("votes")
          .select("work_id")
          .eq("vote_date", today)
          .eq("voter_ip", p_voter_id)
      : Promise.resolve({ data: [], error: null } as {
          data: Array<{ work_id: string }> | null;
          error: null;
        });

    const [byClient, byIp] = await Promise.all([byClientPromise, byIpPromise]);
    if (byClient.error && byIp.error) {
      console.error("votes.route today query failed:", byClient.error, byIp.error);
      return NextResponse.json({ error: "投票失败，请稍后重试" }, { status: 500 });
    }

    const votedToday = new Set<string>();
    for (const row of [...(byClient.data ?? []), ...(byIp.data ?? [])]) {
      if (row?.work_id) votedToday.add(row.work_id);
    }

    // 3) 同作品同日不可重复
    if (votedToday.has(p_work_id)) {
      return NextResponse.json({ ok: false, reason: "今日已为该作品投过票" }, { status: 200 });
    }

    // 4) 每日 3 票上限
    if (votedToday.size >= 3) {
      return NextResponse.json({ ok: false, reason: "limit_reached" }, { status: 200 });
    }

    // 5) 直接写 votes 表（不依赖 cast_vote 函数）
    const { error: insErr } = await supabase.from("votes").insert({
      work_id: p_work_id,
      voter_ip: p_voter_ip,
      voter_client_id: p_voter_id || null,
      vote_date: today,
    });
    if (insErr) {
      console.error("votes.route insert failed:", insErr);
      return NextResponse.json({ error: "投票失败，请稍后重试" }, { status: 500 });
    }

    // 6) 回写作品总票数（兼容 works.votes_count / works.votes）
    const { count: totalCount, error: cntErr } = await supabase
      .from("votes")
      .select("*", { count: "exact", head: true })
      .eq("work_id", p_work_id);
    if (!cntErr && typeof totalCount === "number") {
      const nextVotes = Number(totalCount ?? 0);
      const { error: upCountErr } = await supabase
        .from("works")
        .update({ votes_count: nextVotes })
        .eq("id", p_work_id);
      if (upCountErr) {
        const { error: upLegacyErr } = await supabase
          .from("works")
          .update({ votes: nextVotes } as never)
          .eq("id", p_work_id);
        if (upLegacyErr) {
          console.error("votes.route update tally failed:", upCountErr, upLegacyErr);
        }
      }
    } else if (cntErr) {
      console.error("votes.route recount failed:", cntErr);
    }

    return NextResponse.json({ ok: true } as CastVoteResult);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
