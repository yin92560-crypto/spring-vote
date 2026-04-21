import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/get-client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getVoteRedis,
  keyDailyUserVotes,
  keyDirtyWorkDays,
  keyWorkDayVotes,
  parseWorkDayMember,
  voteUserKey,
} from "@/lib/vote-redis";
import { addDisplayNumbers } from "@/lib/work-display";
import type { Work } from "@/lib/types";
import {
  isAcceptableWorksImagePath,
  normalizeWorkImageUrl,
} from "@/lib/work-image-url";
import {
  fetchWorksTableAll,
  fetchWorksTableWithOr,
  votesFromRow,
} from "@/lib/supabase-works-columns";
import { DAILY_VOTE_LIMIT } from "@/lib/vote-config";
import { fetchTodayVoterUsageFromDb } from "@/lib/today-voter-usage";

export const dynamic = "force-dynamic";
const WORKS_LIST_CACHE_KEY = "works:list:v1";
const RANK_LIST_CACHE_KEY = "rank:list:v1";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WorksCacheItem = Pick<
  Work,
  "id" | "title" | "workTitle" | "authorName" | "imageUrl" | "votes" | "createdAt" | "displayNo"
>;

function withNormalizedImageUrls(items: WorksCacheItem[]): WorksCacheItem[] {
  return items.map((w) => ({
    ...w,
    imageUrl: normalizeWorkImageUrl(w.imageUrl),
  }));
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

    const redis = getVoteRedis();
    // 搜索接口：作品名 + 作者双维度匹配，限制返回前 20。
    if (searchKeyword.length >= 2) {
      const safeKeyword = searchKeyword.slice(0, 40).replace(/[%_]/g, "");
      const supabase = createAdminClient();
      let workRows;
      let tallyColumn;
      try {
        const r = await fetchWorksTableWithOr(
          supabase,
          `work_title.ilike.%${safeKeyword}%,author_name.ilike.%${safeKeyword}%`,
          { limit: searchLimit + 1 }
        );
        workRows = r.rows;
        tallyColumn = r.tallyColumn;
      } catch (wErr) {
        console.error(wErr);
        return NextResponse.json({ error: "搜索失败，请稍后重试" }, { status: 500 });
      }

      const limited = workRows.length > searchLimit;

      const list = addDisplayNumbers(
        workRows.slice(0, searchLimit).map((w) => ({
          id: w.id as string,
          title: w.title as string,
          workTitle: (w.work_title as string | null) ?? (w.title as string),
          authorName: (w.author_name as string | null) ?? "",
          imageUrl: normalizeWorkImageUrl(w.image_url as string),
          votes: votesFromRow(w, tallyColumn),
          createdAt: w.created_at as string,
        })),
      );

      const userKey = voterId || voteUserKey(ip, ua);
      const usedRedis = Number((await redis.get<number>(keyDailyUserVotes(today, userKey))) ?? 0);
      let used = usedRedis;
      let votedWorkIds: string[] = [];
      if (voterId) {
        const db = await fetchTodayVoterUsageFromDb(supabase, voterId, today);
        votedWorkIds = db.votedWorkIds;
        used = Math.max(usedRedis, db.usedDistinctWorks);
      }
      const remaining = Math.max(0, DAILY_VOTE_LIMIT - used);
      return NextResponse.json({
        works: list,
        remaining,
        limited,
        dailyVoteLimit: DAILY_VOTE_LIMIT,
        votedWorkIds,
      });
    }
    let list: WorksCacheItem[] | null = null;
    try {
      const cached = await redis.get<string>(WORKS_LIST_CACHE_KEY);
      if (typeof cached === "string" && cached) {
        list = withNormalizedImageUrls(JSON.parse(cached) as WorksCacheItem[]);
      }
    } catch (cacheErr) {
      console.error("read works cache failed:", cacheErr);
    }

    if (!list) {
      const supabase = createAdminClient();
      let workRows;
      let tallyColumn;
      try {
        const r = await fetchWorksTableAll(supabase);
        workRows = r.rows;
        tallyColumn = r.tallyColumn;
      } catch (wErr) {
        console.error(wErr);
        const message =
          wErr instanceof Error ? wErr.message : String(wErr ?? "读取作品失败");
        return NextResponse.json({ error: message, detail: wErr }, { status: 500 });
      }

      list = addDisplayNumbers(
        workRows.map((w) => ({
          id: w.id as string,
          title: w.title as string,
          workTitle: (w.work_title as string | null) ?? (w.title as string),
          authorName: (w.author_name as string | null) ?? "",
          imageUrl: normalizeWorkImageUrl(w.image_url as string),
          votes: votesFromRow(w, tallyColumn),
          createdAt: w.created_at as string,
        }))
      );
      try {
        await redis.set(WORKS_LIST_CACHE_KEY, JSON.stringify(list), { ex: 60 });
      } catch (cacheErr) {
        console.error("write works cache failed:", cacheErr);
      }
    }

    // 叠加 Redis 中尚未回写到 Supabase 的票数，保证前台实时展示。
    try {
      const dirtyMembers = (await redis.smembers<string[]>(keyDirtyWorkDays())) ?? [];
      for (const member of dirtyMembers) {
        const parsed = parseWorkDayMember(member);
        if (!parsed) continue;
        const n = Number(
          (await redis.get<number>(keyWorkDayVotes(parsed.day, parsed.workId))) ?? 0
        );
        if (n > 0) {
          const target = list.find((w) => w.id === parsed.workId);
          if (target) target.votes += n;
        }
      }
    } catch (redisErr) {
      console.error("read redis vote cache failed:", redisErr);
    }

    // 优先用浏览器持久 voterId + 数据库今日投票记录计算剩余票数（与 Redis 取较大已用值，避免漏计）。
    const userKey = voterId || voteUserKey(ip, ua);
    const usedRedis = Number((await redis.get<number>(keyDailyUserVotes(today, userKey))) ?? 0);
    let used = usedRedis;
    let votedWorkIds: string[] = [];
    if (voterId) {
      const supabase = createAdminClient();
      const db = await fetchTodayVoterUsageFromDb(supabase, voterId, today);
      votedWorkIds = db.votedWorkIds;
      used = Math.max(usedRedis, db.usedDistinctWorks);
    }
    const remaining = Math.max(0, DAILY_VOTE_LIMIT - used);

    return NextResponse.json({
      works: list,
      remaining,
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
    try {
      const redis = getVoteRedis();
      await redis.del(WORKS_LIST_CACHE_KEY);
      await redis.del(RANK_LIST_CACHE_KEY);
    } catch (cacheErr) {
      console.error("invalidate works cache failed:", cacheErr);
    }

    return NextResponse.json({ ok: true, id: workId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
