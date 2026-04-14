import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Params) {
  try {
    const secret = process.env.ADMIN_SECRET;
    if (secret) {
      const sent = request.headers.get("x-admin-secret");
      if (sent !== secret) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
      }
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      workTitle?: string;
      authorName?: string;
    };
    const workTitle = String(body.workTitle ?? "").trim();
    const authorName = String(body.authorName ?? "").trim();

    if (!workTitle) {
      return NextResponse.json({ error: "作品名称不能为空" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("works")
      .update({
        work_title: workTitle,
        author_name: authorName,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "更新作品失败" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Params) {
  try {
    const secret = process.env.ADMIN_SECRET;
    if (secret) {
      const sent = request.headers.get("x-admin-secret");
      if (sent !== secret) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
      }
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: row, error: fErr } = await supabase
      .from("works")
      .select("image_path")
      .eq("id", id)
      .maybeSingle();

    if (fErr) {
      console.error(fErr);
      return NextResponse.json({ error: "查询作品失败" }, { status: 500 });
    }

    if (!row?.image_path) {
      return NextResponse.json({ error: "作品不存在" }, { status: 404 });
    }

    const { error: rmErr } = await supabase.storage
      .from("photos")
      .remove([row.image_path as string]);

    if (rmErr) {
      console.error(rmErr);
    }

    const { error: dErr } = await supabase.from("works").delete().eq("id", id);

    if (dErr) {
      console.error(dErr);
      return NextResponse.json({ error: "删除作品失败" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
