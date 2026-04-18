import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/get-client-ip";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CastVoteResult = { ok?: boolean; reason?: string };

export async function POST(request: Request) {
  try {
    let body: { workId?: string; voterId?: string; voter_ip?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "无效请求" }, { status: 400 });
    }

    const workId = body.workId;
    if (!workId || typeof workId !== "string") {
      return NextResponse.json({ error: "缺少作品 id" }, { status: 400 });
    }

    /** voterId 与 voter_ip 均应为 localStorage 中同一 UUID（兼容字段名 voter_ip） */
    const incomingVoterId = String(body.voterId ?? body.voter_ip ?? "").trim();
    const p_voter_id = UUID_RE.test(incomingVoterId) ? incomingVoterId : "";

    const ip = getClientIp(request.headers);
    const p_voter_ip =
      (typeof ip === "string" && ip.trim() !== "" ? ip.trim() : null) ?? "unknown";

    let rpcData: CastVoteResult | null = null;

    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc("cast_vote", {
        p_work_id: workId,
        p_voter_ip,
        p_voter_id,
      });

      if (error) {
        console.error("cast_vote RPC failed:", error);
        const msg = String((error as { message?: string }).message ?? "");
        if (/limit_reached/i.test(msg)) {
          return NextResponse.json(
            { ok: false, reason: "limit_reached" },
            { status: 200 }
          );
        }
        if (/今日投票次数已达上限|已为该作品投过票|次数已达上限/.test(msg)) {
          return NextResponse.json(
            { ok: false, reason: msg },
            { status: 200 }
          );
        }
        return NextResponse.json({ error: "投票失败，请稍后重试" }, { status: 500 });
      }

      rpcData = data as CastVoteResult | null;
    } catch (rpcErr) {
      console.error("cast_vote RPC exception:", rpcErr);
      return NextResponse.json({ error: "投票失败，请稍后重试" }, { status: 500 });
    }

    /** RPC 正常返回 JSON 且 ok: false 时，原样把 reason 交给前端（不抛错） */
    if (!rpcData?.ok) {
      const rawReason =
        typeof rpcData?.reason === "string" ? rpcData.reason : "投票失败";
      const reason =
        /limit_reached/i.test(rawReason) ? "limit_reached" : rawReason;
      return NextResponse.json({
        ok: false,
        reason,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
