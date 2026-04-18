"use client";

import { getOrCreateClientVoterId } from "@/lib/client-voter-id";

function todayShanghai(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dailyUsedKey(voterId: string): string {
  return `spring-vote-daily-used:${todayShanghai()}:${voterId}`;
}

/** 当前 voter_id 在上海「今天」已用票数（0–3），仅供前端展示与拦截。 */
export function getClientDailyVoteUsed(): number {
  if (typeof window === "undefined") return 0;
  const id = getOrCreateClientVoterId();
  if (!id) return 0;
  try {
    const raw = window.localStorage.getItem(dailyUsedKey(id));
    const n = Number(raw ?? "0");
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(3, Math.floor(n));
  } catch {
    return 0;
  }
}

/** 投票成功后增加本地计数，与 getClientDailyVoteUsed 成对使用 */
export function incrementClientDailyVoteUsed(): number {
  if (typeof window === "undefined") return 0;
  const id = getOrCreateClientVoterId();
  if (!id) return 0;
  try {
    const key = dailyUsedKey(id);
    const next = Math.min(3, getClientDailyVoteUsed() + 1);
    window.localStorage.setItem(key, String(next));
    return next;
  } catch {
    return getClientDailyVoteUsed();
  }
}
