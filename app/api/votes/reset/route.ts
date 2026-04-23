import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** 清空全部投票记录（管理用）。若设置了 ADMIN_SECRET，需在请求头 x-admin-secret 中携带。 */
export async function POST(request: Request) {
  try {
    const secret = process.env.ADMIN_SECRET;
    if (secret) {
      const sent = request.headers.get("x-admin-secret");
      if (sent !== secret) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
      }
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("votes")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "清空失败" }, { status: 500 });
    }

    const nilId = "00000000-0000-0000-0000-000000000000";
    const { error: wcErr } = await supabase
      .from("works")
      .update({ votes_count: 0 })
      .neq("id", nilId);
    if (wcErr) {
      console.error(wcErr);
      return NextResponse.json({ error: "清空作品票数汇总失败" }, { status: 500 });
    }

    // Redis 已禁用：不再进行任何 Upstash 清理动作。

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
