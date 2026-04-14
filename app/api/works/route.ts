import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/get-client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { shanghaiDateString } from "@/lib/shanghai-date";
import { addDisplayNumbers } from "@/lib/work-display";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();
    const ip = getClientIp(request.headers);
    const today = shanghaiDateString();

    const { data: works, error: wErr } = await supabase
      .from("works")
      .select("id, title, work_title, author_name, image_url, created_at")
      .order("created_at", { ascending: false });

    if (wErr) {
      console.error(wErr);
      return NextResponse.json({ error: "读取作品失败" }, { status: 500 });
    }

    const { data: voteRows, error: vErr } = await supabase
      .from("votes")
      .select("work_id");

    if (vErr) {
      console.error(vErr);
      return NextResponse.json({ error: "读取票数失败" }, { status: 500 });
    }

    const counts = new Map<string, number>();
    for (const row of voteRows ?? []) {
      const wid = row.work_id as string;
      counts.set(wid, (counts.get(wid) ?? 0) + 1);
    }

    const list = addDisplayNumbers(
      (works ?? []).map((w) => ({
        id: w.id as string,
        title: w.title as string,
        workTitle: (w.work_title as string | null) ?? (w.title as string),
        authorName: (w.author_name as string | null) ?? "",
        imageUrl: w.image_url as string,
        votes: counts.get(w.id as string) ?? 0,
        createdAt: w.created_at as string,
      }))
    );

    const { count: usedToday, error: cErr } = await supabase
      .from("votes")
      .select("*", { count: "exact", head: true })
      .eq("voter_ip", ip)
      .eq("vote_date", today);

    if (cErr) {
      console.error(cErr);
      return NextResponse.json({ error: "读取剩余票数失败" }, { status: 500 });
    }

    const used = usedToday ?? 0;
    const remaining = Math.max(0, 3 - used);

    return NextResponse.json({ works: list, remaining });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      workTitle?: string;
      authorName?: string;
      imageUrl?: string;
      imagePath?: string;
    };
    const title = String(body.title ?? "");
    const workTitle = String(body.workTitle ?? "");
    const authorName = String(body.authorName ?? "");
    const imageUrl = String(body.imageUrl ?? "").trim();
    const imagePath = String(body.imagePath ?? "").trim();

    if (!imageUrl || !imagePath) {
      return NextResponse.json(
        { error: "缺少 R2 图片地址或路径" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const workId = crypto.randomUUID();

    const safeTitle = title.trim() || workTitle.trim() || "未命名作品";
    const safeWorkTitle = workTitle.trim() || safeTitle;
    const safeAuthorName = authorName.trim();

    const { error: insErr } = await supabase.from("works").insert({
      id: workId,
      title: safeTitle,
      work_title: safeWorkTitle,
      author_name: safeAuthorName,
      image_path: imagePath,
      image_url: imageUrl,
    });

    if (insErr) {
      console.error(insErr);
      return NextResponse.json({ error: "保存作品失败" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: workId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
