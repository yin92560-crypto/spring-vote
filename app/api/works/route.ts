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

function toDisplayNo(raw: unknown): string {
  const text = String(raw ?? "").trim();
  const digits = text.replace(/\D/g, "");
  if (!digits) return "";
  return String(Number(digits));
}

function buildWorksPayload(
  rows: unknown[],
  page: number,
  pageSize: number,
  totalCount: number
): WorksApiItem[] {
  return rows.map((w, idx) => {
    const fallbackNo = Math.max(1, totalCount - (page - 1) * pageSize - idx);
    const rawNo = toDisplayNo(
      (w as { displayNo?: unknown; display_no?: unknown; displayno?: unknown })
        .displayNo ??
        (w as { display_no?: unknown }).display_no ??
        (w as { displayno?: unknown }).displayno
    );
    return {
      id: String((w as { id?: unknown }).id ?? ""),
      displayNo: rawNo || String(fallbackNo),
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
    };
  });
}

async function fetchWorksPageWithFallback(
  supabase: ReturnType<typeof createAdminClient>,
  options: { from: number; to: number; withCount?: boolean; searchKeyword?: string }
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
      const keyword = searchKeyword.trim();
      const isDigitsOnly = /^\d+$/.test(keyword);
      const normalizedDigits = keyword.replace(/^0+/, "") || "0";
      const orParts = isDigitsOnly
        ? [
            `display_no.eq.${normalizedDigits}`,
            `work_title.ilike.%${keyword}%`,
            `title.ilike.%${keyword}%`,
            `author_name.ilike.%${keyword}%`,
            `author.ilike.%${keyword}%`,
          ]
        : [
            `work_title.ilike.%${keyword}%`,
            `title.ilike.%${keyword}%`,
            `author_name.ilike.%${keyword}%`,
            `author.ilike.%${keyword}%`,
          ];
      q = q.or(orParts.join(","));
    }
    return q.range(from, to);
  };

  const first = await buildBase()
    .order("display_no", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!first.error) {
    return { data: first.data, count: first.count, error: null };
  }

  const msg = String(first.error.message ?? "").toLowerCase();
  const displayNoMissing = msg.includes("display_no") && msg.includes("does not exist");
  if (!displayNoMissing) {
    return {
      data: first.data,
      count: first.count,
      error: { message: first.error.message ?? "读取作品失败" },
    };
  }

  const fallback = await buildBase().order("created_at", { ascending: false });
  if (fallback.error) {
    return {
      data: fallback.data,
      count: fallback.count,
      error: { message: fallback.error.message ?? "读取作品失败" },
    };
  }
  return { data: fallback.data, count: fallback.count, error: null };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawSearchParam =
      url.searchParams.get("search") ??
      url.searchParams.get("q") ??
      url.searchParams.get("query") ??
      url.searchParams.get("keyword") ??
      url.searchParams.get("search");
    const searchKeyword = (rawSearchParam ?? "").trim();
    const fetchAll = url.searchParams.get("all") === "1";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = fetchAll ? 1000 : PAGE_SIZE;

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
    // 搜索接口：全库匹配（display_no 精确 + 标题模糊），并支持分页联动。
    if (searchKeyword.length > 0) {
      const safeKeyword = searchKeyword.slice(0, 40);
      const { data: pageRows, error: listErr, count } = await fetchWorksPageWithFallback(
        supabase,
        {
          from,
          to,
          withCount: true,
          searchKeyword: safeKeyword,
        }
      );
      if (listErr) {
        console.error(listErr);
        return NextResponse.json({ error: "搜索失败，请稍后重试" }, { status: 500 });
      }
      const rows = Array.isArray(pageRows) ? pageRows : [];
      const total = Number(count ?? 0);
      const list = buildWorksPayload(rows, page, pageSize, total);
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
        data: list,
        works: list,
        totalCount: total,
        search: safeKeyword,
        remaining,
        limited: hasMore,
        page,
        limit: pageSize,
        total,
        hasMore,
        dailyVoteLimit: DAILY_VOTE_LIMIT,
        votedWorkIds,
      });
    }
    const { data, error: listErr, count } = await fetchWorksPageWithFallback(
      supabase,
      { from, to, withCount: true }
    );
    if (listErr) {
      console.error(listErr);
      const message = listErr.message || "读取作品失败";
      return NextResponse.json({ error: message, detail: listErr }, { status: 500 });
    }
    const workRows = Array.isArray(data) ? data : [];
    const total = Number(count ?? 0);
    const list = buildWorksPayload(workRows, page, pageSize, total);
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
      data: list,
      works: list,
      totalCount: total,
      remaining,
      page,
      limit: pageSize,
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
