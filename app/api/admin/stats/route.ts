import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

    const { data: pvRow, error: pvErr } = await supabase
      .from("site_stats")
      .select("page_views")
      .eq("page_key", "home")
      .maybeSingle();

    if (pvErr) {
      console.error("read pv failed, fallback to non-zero value:", pvErr);
    }

    const pv = Math.max(1, Number(pvRow?.page_views ?? 1));

    return NextResponse.json({
      pv,
      works: Number(worksCount ?? 0),
      votes: Number(votesCount ?? 0),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
