"use client";

import { getOrCreateClientVoterId } from "@/lib/client-voter-id";

/** 与需求一致：投票记录（作品 ID + 上海日期 + voter_id）持久化键 */
export const HUAQIN_VOTED_LIST_KEY = "huaqin_voted_list";

export type HuaqinVoteEntry = {
  workId: string;
  /** YYYY-MM-DD（Asia/Shanghai） */
  date: string;
  voterId: string;
};

export function getTodayShanghai(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function legacyDailyUsedKey(voterId: string, day: string): string {
  return `spring-vote-daily-used:${day}:${voterId}`;
}

function parseStoredList(raw: string | null): HuaqinVoteEntry[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: HuaqinVoteEntry[] = [];
    for (const row of parsed) {
      if (
        row &&
        typeof row === "object" &&
        typeof (row as HuaqinVoteEntry).workId === "string" &&
        typeof (row as HuaqinVoteEntry).date === "string" &&
        typeof (row as HuaqinVoteEntry).voterId === "string"
      ) {
        out.push({
          workId: (row as HuaqinVoteEntry).workId,
          date: (row as HuaqinVoteEntry).date,
          voterId: (row as HuaqinVoteEntry).voterId,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** 指定 voter 在「今天（上海）」的已用票数（去重作品）与已投作品 id */
export function getTodayVoteStateForVoter(voterId: string): {
  used: number;
  votedWorkIds: string[];
} {
  if (typeof window === "undefined" || !voterId) {
    return { used: 0, votedWorkIds: [] };
  }
  try {
    const today = getTodayShanghai();
    const entries = parseStoredList(window.localStorage.getItem(HUAQIN_VOTED_LIST_KEY));
    const todays = entries.filter((e) => e.voterId === voterId && e.date === today);
    const unique = new Set<string>();
    for (const e of todays) unique.add(e.workId);
    const votedWorkIds = [...unique];
    return { used: Math.min(3, unique.size), votedWorkIds };
  } catch {
    return { used: 0, votedWorkIds: [] };
  }
}

/**
 * 投票成功后写入列表并同步旧 count 键，保证刷新后仍能恢复。
 */
export function appendHuaqinVoteRecord(workId: string, voterId: string): number {
  if (typeof window === "undefined" || !voterId) return 0;
  const today = getTodayShanghai();
  let entries = parseStoredList(window.localStorage.getItem(HUAQIN_VOTED_LIST_KEY));
  entries = entries.filter(
    (e) => !(e.voterId === voterId && e.date === today && e.workId === workId)
  );
  entries.push({ workId, date: today, voterId });
  try {
    window.localStorage.setItem(HUAQIN_VOTED_LIST_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
  const { used } = getTodayVoteStateForVoter(voterId);
  try {
    window.localStorage.setItem(legacyDailyUsedKey(voterId, today), String(used));
  } catch {
    /* ignore */
  }
  return used;
}

/** 供首页首屏恢复：确保 voter_id 存在后读取今日状态 */
export function hydrateVoteStateFromStorage(): {
  voterId: string;
  used: number;
  votedWorkIds: string[];
} {
  const voterId = getOrCreateClientVoterId();
  if (!voterId) return { voterId: "", used: 0, votedWorkIds: [] };
  return { voterId, ...getTodayVoteStateForVoter(voterId) };
}
