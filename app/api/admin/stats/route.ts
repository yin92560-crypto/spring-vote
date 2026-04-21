import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const HISTORICAL_PV = 14047;

export async function GET(request: Request) {
  try {
    const secret = process.env.ADMIN_SECRET;
    if (secret) {
      const sent = request.headers.get("x-admin-secret");
      if (sent !== secret) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
      }
    }

    const supabase = createAdminClient();

    const [{ count: worksCount, error: worksErr }, { count: votesCount, error: votesErr }] =
      await Promise.all([
        supabase.from("works").select("*", { count: "exact", head: true }),
        supabase.from("votes").select("*", { count: "exact", head: true }),
      ]);

    if (worksErr || votesErr) {
      console.error(worksErr ?? votesErr);
      return NextResponse.json({ error: "读取统计失败" }, { status: 500 });
    }

    const votes = Number(votesCount ?? 0);
    const pv = HISTORICAL_PV + votes;

    return NextResponse.json({
      pv,
      works: Number(worksCount ?? 0),
      votes,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
