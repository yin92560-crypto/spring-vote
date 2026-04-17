import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/get-client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDisplayNumbers } from "@/lib/work-display";
import { keyDailyUserVotes, getVoteRedis, voteUserKey } from "@/lib/vote-redis";
import { normalizeWorkImageUrl } from "@/lib/work-image-url";
import type { Work } from "@/lib/types";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const keyword = (url.searchParams.get("q") ?? "").trim();
    if (!keyword) {
      return NextResponse.json({ works: [], limited: false });
    }

    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20) || 20, 1), 20);
    const safeKeyword = keyword.slice(0, 40).replace(/[%_]/g, "");

    const ip = getClientIp(request.headers);
    const ua = request.headers.get("user-agent") ?? "";
    const headerVoterId = request.headers.get("x-voter-id")?.trim() ?? "";
    const voterId = UUID_RE.test(headerVoterId) ? headerVoterId : "";
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const supabase = createAdminClient();
    const { data: works, error: wErr } = await supabase
      .from("works")
      .select("id, title, work_title, author_name, image_url, created_at, votes_count")
      .or(`work_title.ilike.%${safeKeyword}%,author_name.ilike.%${safeKeyword}%`)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (wErr) {
      console.error(wErr);
      return NextResponse.json({ error: "搜索失败，请稍后重试" }, { status: 500 });
    }

    const sliced = (works ?? []).slice(0, limit);
    const limited = (works ?? []).length > limit;

    const list = addDisplayNumbers(
      sliced.map((w) => ({
        id: w.id as string,
        title: w.title as string,
        workTitle: (w.work_title as string | null) ?? (w.title as string),
        authorName: (w.author_name as string | null) ?? "",
        imageUrl: normalizeWorkImageUrl(w.image_url as string),
        votes: Number((w as { votes_count?: number | null }).votes_count ?? 0),
        createdAt: w.created_at as string,
      })),
    ) as Work[];

    const redis = getVoteRedis();
    const userKey = voterId || voteUserKey(ip, ua);
    const used = Number((await redis.get<number>(keyDailyUserVotes(today, userKey))) ?? 0);
    const remaining = Math.max(0, 3 - used);

    return NextResponse.json({ works: list, remaining, limited });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

