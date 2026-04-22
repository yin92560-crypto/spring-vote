import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/get-client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isAcceptableWorksImagePath,
  normalizeWorkImageUrl,
} from "@/lib/work-image-url";
import { DAILY_VOTE_LIMIT } from "@/lib/vote-config";
import { fetchTodayVoterUsageFromDb } from "@/lib/today-voter-usage";

export const revalidate = 60;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 24;

type WorksApiItem = {
  id: string;
  displayNo: string;
  title: string;
  workTitle: string;
  authorName: string;
  vote_count: number;
  votes: number;
  imageUrl: string;
};

function toDisplayNo(raw: unknown, indexWithinPage: number, page: number): string {
  void indexWithinPage;
  void page;
  const text = String(raw ?? "").trim();
  const digits = text.replace(/\D/g, "");
  if (digits) return String(Number(digits)).padStart(3, "0");
  return "000";
}

function buildWorksPayload(rows: unknown[], page: number): WorksApiItem[] {
  return rows.map((w, idx) => ({
    id: String((w as { id?: unknown }).id ?? ""),
    displayNo: toDisplayNo(
      (w as { displayNo?: unknown; display_no?: unknown }).displayNo ??
        (w as { display_no?: unknown }).display_no,
      idx,
      page
    ),
    title: String(
      (w as { work_title?: unknown; title?: unknown }).work_title ??
        (w as { title?: unknown }).title ??
        ""
    ),
    workTitle: String(
      (w as { work_title?: unknown; title?: unknown }).work_title ??
        (w as { title?: unknown }).title ??
        ""
    ),
    authorName: String(
      (w as { author_name?: unknown; author?: unknown; username?: unknown }).author_name ??
        (w as { author?: unknown }).author ??
        (w as { username?: unknown }).username ??
        ""
    ),
    vote_count: Number(
      (w as { vote_count?: unknown; votes_count?: unknown }).vote_count ??
        (w as { votes_count?: unknown }).votes_count ??
        0
    ),
    votes: Number(
      (w as { vote_count?: unknown; votes_count?: unknown }).vote_count ??
        (w as { votes_count?: unknown }).votes_count ??
        0
    ),
    imageUrl: normalizeWorkImageUrl(String((w as { image_url?: unknown }).image_url ?? "")),
  })).sort((a, b) => {
    const aNo = Number(a.displayNo) || 0;
    const bNo = Number(b.displayNo) || 0;
    return bNo - aNo;
  });
}

async function fetchWorksPageWithFallback(
  supabase: ReturnType<typeof createAdminClient>,
  options: {
    from: number;
    to: number;
    withCount?: boolean;
    searchKeyword?: string;
  }
): Promise<{
  data: unknown[] | null;
  count: number | null;
  error: { message?: string } | null;
}> {
  const { from, to, withCount = true, searchKeyword } = options;
  const selectOpts = withCount ? ({ count: "exact" } as const) : undefined;

  const buildBase = () => {
    let q = supabase.from("works").select("*", selectOpts);
    if (searchKeyword) {
      q = q.or(`work_title.ilike.%${searchKeyword}%,title.ilike.%${searchKeyword}%`);
    }
    return q.range(from, to);
  };

  // 优先按 display_no 排序；若线上缺列则降级 created_at。
  let first = await buildBase()
    .order("display_no", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!first.error) {
    return {
      data: first.data as unknown[] | null,
      count: (first as { count?: number | null }).count ?? null,
      error: null,
    };
  }

  const msg = String(first.error.message ?? "").toLowerCase();
  const displayNoMissing = msg.includes("display_no") && msg.includes("does not exist");
  if (!displayNoMissing) {
    return {
      data: first.data as unknown[] | null,
      count: (first as { count?: number | null }).count ?? null,
      error: first.error as { message?: string },
    };
  }

  const fallback = await buildBase().order("created_at", { ascending: false });
  return {
    data: fallback.data as unknown[] | null,
    count: (fallback as { count?: number | null }).count ?? null,
    error: fallback.error as { message?: string } | null,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawSearchParam =
      url.searchParams.get("q") ??
      url.searchParams.get("query") ??
      url.searchParams.get("keyword") ??
      url.searchParams.get("search");
    const searchKeyword = (rawSearchParam ?? "").trim();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.max(1, Number(url.searchParams.get("limit") ?? PAGE_SIZE) || PAGE_SIZE);

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
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    // 搜索接口：作品名 + 作者双维度匹配，限制返回前 20。
    if (searchKeyword.length >= 2) {
      const safeKeyword = searchKeyword.slice(0, 40);
      const { data: pageRows, error: listErr, count } = await fetchWorksPageWithFallback(
        supabase,
        { from, to, withCount: true, searchKeyword: safeKeyword }
      );
      if (listErr) {
        console.error(listErr);
        return NextResponse.json({ error: "搜索失败，请稍后重试" }, { status: 500 });
      }
      const rows = Array.isArray(pageRows) ? pageRows : [];
      const list = buildWorksPayload(rows, page);
      const total = Number(count ?? list.length);
      const hasMore = page * pageSize < total;

      let used = 0;
      let votedWorkIds: string[] = [];
      if (voterId) {
        const db = await fetchTodayVoterUsageFromDb(supabase, voterId, today);
        votedWorkIds = db.votedWorkIds;
        used = db.usedDistinctWorks;
      }
      const remaining = Math.max(0, DAILY_VOTE_LIMIT - used);
      return NextResponse.json({
        works: list,
        remaining,
        limited: hasMore,
        page,
        pageSize,
        total,
        hasMore,
        dailyVoteLimit: DAILY_VOTE_LIMIT,
        votedWorkIds,
      });
    }
    const { data, error: listErr, count } = await fetchWorksPageWithFallback(supabase, {
      from,
      to,
      withCount: true,
    });
    if (listErr) {
      console.error(listErr);
      const message = listErr.message || "读取作品失败";
      return NextResponse.json({ error: message, detail: listErr }, { status: 500 });
    }
    const workRows = Array.isArray(data) ? data : [];
    const list = buildWorksPayload(workRows, page);
    const total = Number(count ?? list.length);
    const hasMore = page * pageSize < total;

    // 仅基于 Supabase 今日投票记录计算剩余票数。
    let used = 0;
    let votedWorkIds: string[] = [];
    if (voterId) {
      const db = await fetchTodayVoterUsageFromDb(supabase, voterId, today);
      votedWorkIds = db.votedWorkIds;
      used = db.usedDistinctWorks;
    }
    const remaining = Math.max(0, DAILY_VOTE_LIMIT - used);

    return NextResponse.json({
      works: list,
      remaining,
      page,
      pageSize,
      total,
      hasMore,
      dailyVoteLimit: DAILY_VOTE_LIMIT,
      votedWorkIds,
    });
  } catch (error) {
    console.error("Full Error Detail:", error);
    const errObj = error as {
      message?: string;
      code?: string;
      hint?: string;
    };
    return NextResponse.json(
      {
        msg: errObj?.message ?? String(error),
        code: errObj?.code ?? null,
        hint: errObj?.hint ?? null,
      },
      { status: 500 }
    );
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
    const imageUrl = normalizeWorkImageUrl(String(body.imageUrl ?? "").trim());
    const imagePath = String(body.imagePath ?? "").trim();

    if (!imageUrl || !imagePath) {
      return NextResponse.json(
        { error: "缺少 R2 图片地址或路径" },
        { status: 400 }
      );
    }

    if (!/^https:\/\//i.test(imageUrl)) {
      return NextResponse.json(
        { error: "图片地址须为完整的 https URL（含域名与对象路径）" },
        { status: 400 }
      );
    }

    if (!isAcceptableWorksImagePath(imagePath)) {
      return NextResponse.json(
        { error: "图片路径含非法字符，请重新上传" },
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
