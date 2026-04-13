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
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "");
    const workTitle = String(formData.get("workTitle") ?? "");
    const authorName = String(formData.get("authorName") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "请上传图片文件" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "仅支持图片格式" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const workId = crypto.randomUUID();
    const ext = file.name.split(".").pop() ?? "jpg";
    const safeExt = /^[a-zA-Z0-9]+$/.test(ext) ? ext : "jpg";
    const path = `works/${workId}/${Date.now()}.${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("photos")
      .upload(path, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (upErr) {
      console.error(upErr);
      return NextResponse.json({ error: "图片上传失败" }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("photos").getPublicUrl(path);

    const safeTitle = title.trim() || workTitle.trim() || "未命名作品";
    const safeWorkTitle = workTitle.trim() || safeTitle;
    const safeAuthorName = authorName.trim();

    const { error: insErr } = await supabase.from("works").insert({
      id: workId,
      title: safeTitle,
      work_title: safeWorkTitle,
      author_name: safeAuthorName,
      image_path: path,
      image_url: publicUrl,
    });

    if (insErr) {
      console.error(insErr);
      await supabase.storage.from("photos").remove([path]);
      return NextResponse.json({ error: "保存作品失败" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: workId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
