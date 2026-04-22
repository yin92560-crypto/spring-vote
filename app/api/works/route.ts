import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/get-client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDisplayNumbersPreferExisting } from "@/lib/work-display";
import type { Work } from "@/lib/types";
import {
  isAcceptableWorksImagePath,
  normalizeWorkImageUrl,
} from "@/lib/work-image-url";
import { DAILY_VOTE_LIMIT } from "@/lib/vote-config";
import { fetchTodayVoterUsageFromDb } from "@/lib/today-voter-usage";

export const dynamic = "force-dynamic";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function fetchAllVoteWorkIds(
  supabase: ReturnType<typeof createAdminClient>
): Promise<string[]> {
  const pageSize = 1000;
  let from = 0;
  const all: string[] = [];
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("votes")
      .select("work_id")
      .range(from, to);
    if (error) {
      throw error;
    }
    const rows = data ?? [];
    for (const row of rows) {
      const workId = String((row as { work_id?: unknown }).work_id ?? "");
      if (workId) all.push(workId);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchVoteCountsMap(
  supabase: ReturnType<typeof createAdminClient>,
  validWorkIds: Set<string>
): Promise<Map<string, number>> {
  let voteWorkIds: string[] = [];
  try {
    voteWorkIds = await fetchAllVoteWorkIds(supabase);
  } catch (error) {
    console.error("fetch votes for count failed:", error);
    return new Map();
  }
  const counts = new Map<string, number>();
  let invalidWorkIdCount = 0;
  for (const workId of voteWorkIds) {
    if (!validWorkIds.has(workId)) {
      invalidWorkIdCount += 1;
      continue;
    }
    counts.set(workId, (counts.get(workId) ?? 0) + 1);
  }
  if (invalidWorkIdCount > 0) {
    console.warn("votes rows without matching works.id:", invalidWorkIdCount);
  }
  return counts;
}

function buildWorksPayload(
  rows: unknown[],
  voteCounts: Map<string, number>
): Array<Work & { vote_count: number; actualVotes: number }> {
  const baseRows: Array<Omit<Work, "displayNo"> & { displayNo?: string | null }> = rows.map((w) => {
    const id = String((w as { id?: unknown }).id ?? "");
    const votes = voteCounts.get(id) ?? 0;
    return {
      id,
      title: String((w as { title?: unknown }).title ?? ""),
      workTitle: String(
        (w as { work_title?: unknown; title?: unknown }).work_title ??
          (w as { title?: unknown }).title ??
          ""
      ),
      authorName: String((w as { author_name?: unknown }).author_name ?? ""),
      imageUrl: normalizeWorkImageUrl(
        String((w as { image_url?: unknown }).image_url ?? "")
      ),
      votes,
      createdAt: String((w as { created_at?: unknown }).created_at ?? ""),
      displayNo:
        String(
          (w as { displayNo?: unknown; display_no?: unknown }).displayNo ??
            (w as { display_no?: unknown }).display_no ??
            ""
        ) || undefined,
    };
  });

  const withDisplayNo = addDisplayNumbersPreferExisting(baseRows);
  const withFields = withDisplayNo.map((w, index) => ({
    ...w,
    displayNo: w.displayNo || `No.${String(index + 1).padStart(3, "0")}`,
    vote_count: w.votes,
    actualVotes: w.votes,
  }));
  // 首页排序：编号越大越靠前（如 No.700+ 在最前）。
  return withFields.sort((a, b) => {
    const aNo = Number(String(a.displayNo).replace(/\D/g, "")) || 0;
    const bNo = Number(String(b.displayNo).replace(/\D/g, "")) || 0;
    if (bNo !== aNo) return bNo - aNo;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
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
    const fetchAll = url.searchParams.get("all") === "1";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = 24;
    const searchLimit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? 20) || 20, 1),
      20,
    );

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
    // 搜索接口：作品名 + 作者双维度匹配，限制返回前 20。
    if (searchKeyword.length >= 2) {
      const { data: allRows, error: allErr } = await supabase
        .from("works")
        .select("*")
        .order("created_at", { ascending: false });
      if (allErr) {
        console.error(allErr);
        return NextResponse.json({ error: "搜索失败，请稍后重试" }, { status: 500 });
      }
      const rows = Array.isArray(allRows) ? allRows : [];
      const voteCounts = await fetchVoteCountsMap(
        supabase,
        new Set(rows.map((w) => String((w as { id?: unknown }).id ?? "")))
      );
      const safeKeyword = searchKeyword.slice(0, 40).toLowerCase();
      const filtered = rows.filter((w) => {
        const title = String((w as { work_title?: unknown; title?: unknown }).work_title ?? (w as { title?: unknown }).title ?? "").toLowerCase();
        const author = String((w as { author_name?: unknown }).author_name ?? "").toLowerCase();
        return title.includes(safeKeyword) || author.includes(safeKeyword);
      });
      const limited = filtered.length > searchLimit;
      const list = buildWorksPayload(filtered.slice(0, searchLimit), voteCounts);
      const start = fetchAll ? 0 : (page - 1) * pageSize;
      const end = fetchAll ? list.length : start + pageSize;
      const pageWorks = list.slice(start, end);
      const hasMore = !fetchAll && end < list.length;

      let used = 0;
      let votedWorkIds: string[] = [];
      if (voterId) {
        const db = await fetchTodayVoterUsageFromDb(supabase, voterId, today);
        votedWorkIds = db.votedWorkIds;
        used = db.usedDistinctWorks;
      }
      const remaining = Math.max(0, DAILY_VOTE_LIMIT - used);
      return NextResponse.json({
        works: pageWorks,
        remaining,
        limited,
        page,
        pageSize,
        total: list.length,
        hasMore,
        dailyVoteLimit: DAILY_VOTE_LIMIT,
        votedWorkIds,
      });
    }
    const { data, error: listErr } = await supabase
      .from("works")
      .select("*")
      .order("created_at", { ascending: false });
    if (listErr) {
      console.error(listErr);
      const message = listErr.message || "读取作品失败";
      return NextResponse.json({ error: message, detail: listErr }, { status: 500 });
    }
    const workRows = Array.isArray(data) ? data : [];
    console.log("Final Data Count:", workRows.length);
    const voteCounts = await fetchVoteCountsMap(
      supabase,
      new Set(workRows.map((w) => String((w as { id?: unknown }).id ?? "")))
    );
    const list = buildWorksPayload(workRows, voteCounts);
    const start = fetchAll ? 0 : (page - 1) * pageSize;
    const end = fetchAll ? list.length : start + pageSize;
    const pageWorks = list.slice(start, end);
    const hasMore = !fetchAll && end < list.length;

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
      works: pageWorks,
      remaining,
      page,
      pageSize,
      total: list.length,
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
