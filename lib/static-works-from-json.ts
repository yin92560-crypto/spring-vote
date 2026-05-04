import type { Work } from "@/lib/types";
import { normalizeWorkImageUrl } from "@/lib/work-image-url";

/** 与 public/data.json 中单条作品结构对齐（字段可为字符串或数字） */
export type StaticJsonWorkRow = Record<string, unknown>;

export const RANK_LEADERBOARD_LIMIT = 61;

export const HOME_PAGE_SIZE = 24;
export const SEARCH_PAGE_SIZE = 12;

function parseVotesCount(raw: unknown): number {
  const n = Number(String(raw ?? "").trim());
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function displayNoPadded(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return String(Number(digits)).padStart(3, "0");
}

/** 将静态 JSON 中的一行映射为前端 Work */
export function staticJsonRowToWork(row: StaticJsonWorkRow): Work {
  const id = String(row.id ?? "");
  const workTitle = String(row.work_title ?? "");
  const title = String(row.title ?? "");
  const authorName = String(row.author_name ?? row.author ?? "");
  const imageUrl = normalizeWorkImageUrl(String(row.image_url ?? ""));
  const votes = parseVotesCount(row.votes_count ?? row.votes);
  const createdAt = String(row.created_at ?? "");
  let displayNo = displayNoPadded(row.display_no ?? row.displayNo);
  if (!displayNo) displayNo = "000";
  return {
    id,
    displayNo,
    title,
    workTitle: workTitle || title,
    authorName,
    imageUrl,
    votes,
    createdAt,
  };
}

export function parseStaticWorksJsonArray(raw: unknown): Work[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => staticJsonRowToWork(item as StaticJsonWorkRow));
}

let browserInflight: Promise<Work[]> | null = null;

/** 浏览器端拉取 /data.json（整站静态作品列表） */
export async function fetchStaticWorksFromJson(
  signal?: AbortSignal
): Promise<Work[]> {
  const res = await fetch("/data.json", {
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new Error(`加载作品数据失败: HTTP ${res.status}`);
  }
  const raw = (await res.json()) as unknown;
  return parseStaticWorksJsonArray(raw);
}

/** 同一会话内复用一次请求，避免首页 / 弹窗重复拉取 */
export function getCachedStaticWorksFromJson(signal?: AbortSignal): Promise<Work[]> {
  if (!browserInflight) {
    browserInflight = fetchStaticWorksFromJson(signal).catch((e) => {
      browserInflight = null;
      throw e;
    });
  }
  return browserInflight;
}

export function clearStaticWorksJsonCache(): void {
  browserInflight = null;
}

/** 首页列表：按 display_no 数值降序（大号在前） */
export function sortWorksByDisplayNoDesc(works: Work[]): Work[] {
  return [...works].sort((a, b) => {
    const an = Number(String(a.displayNo).replace(/\D/g, "") || 0);
    const bn = Number(String(b.displayNo).replace(/\D/g, "") || 0);
    return bn - an;
  });
}

/** 排行榜：按票数降序，相同票数按创建时间升序 */
export function sortWorksRankedByVotes(works: Work[]): Work[] {
  return [...works].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function filterWorksBySearchKeyword(works: Work[], keyword: string): Work[] {
  const k = keyword.trim().toLowerCase();
  if (!k) return works;
  const digitQuery = k.replace(/\D/g, "");
  const queryNum =
    digitQuery && /^\d+$/.test(digitQuery.trim() || "")
      ? Number(digitQuery)
      : NaN;
  return works.filter((w) => {
    const hay = `${w.workTitle} ${w.title} ${w.authorName}`.toLowerCase();
    if (hay.includes(k)) return true;
    if (Number.isFinite(queryNum) && queryNum > 0) {
      const wn = Number(String(w.displayNo).replace(/\D/g, "") || 0);
      if (wn === queryNum) return true;
    }
    return false;
  });
}
