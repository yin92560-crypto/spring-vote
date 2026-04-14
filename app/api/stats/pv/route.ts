import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { pageKey?: string };
    const pageKey = String(body.pageKey ?? "home").trim() || "home";

    const supabase = createAdminClient();
    const { data: row, error: findErr } = await supabase
      .from("site_stats")
      .select("page_views")
      .eq("page_key", pageKey)
      .maybeSingle();

    if (findErr) {
      console.error(findErr);
      return NextResponse.json({ error: "读取浏览量失败" }, { status: 500 });
    }

    if (!row) {
      const { error: insErr } = await supabase
        .from("site_stats")
        .insert({ page_key: pageKey, page_views: 1 });
      if (insErr) {
        console.error(insErr);
        return NextResponse.json({ error: "写入浏览量失败" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, pageViews: 1 });
    }

    const nextViews = Number(row.page_views ?? 0) + 1;
    const { error: updErr } = await supabase
      .from("site_stats")
      .update({ page_views: nextViews })
      .eq("page_key", pageKey);

    if (updErr) {
      console.error(updErr);
      return NextResponse.json({ error: "更新浏览量失败" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, pageViews: nextViews });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
