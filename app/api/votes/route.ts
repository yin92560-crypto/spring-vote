import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/get-client-ip";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let body: { workId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "无效请求" }, { status: 400 });
    }

    const workId = body.workId;
    if (!workId || typeof workId !== "string") {
      return NextResponse.json({ error: "缺少作品 id" }, { status: 400 });
    }

    const ip = getClientIp(request.headers);
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("cast_vote", {
      p_work_id: workId,
      p_voter_ip: ip,
    });

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "投票失败" }, { status: 500 });
    }

    const result = data as { ok?: boolean; reason?: string } | null;
    if (!result?.ok) {
      return NextResponse.json({
        ok: false,
        reason: result?.reason ?? "无法投票",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
