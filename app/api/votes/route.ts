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
    const p_voter_id = UUID_RE.test(incomingVoterId) ? incomingVoterId : "";

    const ip = getClientIp(request.headers);
    const p_voter_ip =
      (typeof ip === "string" && ip.trim() !== "" ? ip.trim() : null) ?? "unknown";

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("cast_vote", {
      p_work_id: workId,
      p_voter_ip,
      p_voter_id,
    });

    if (error) {
      console.error("cast_vote RPC failed:", error);
      const msg = String((error as { message?: string }).message ?? "");
      if (/今日投票次数已达上限|已为该作品投过票|次数已达上限/.test(msg)) {
        return NextResponse.json(
          { ok: false, reason: msg },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: "投票失败，请稍后重试" }, { status: 500 });
    }

    const result = data as CastVoteResult | null;
    if (!result?.ok) {
      return NextResponse.json({
        ok: false,
        reason: typeof result?.reason === "string" ? result.reason : "投票失败",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
