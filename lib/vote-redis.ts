import { Redis } from "@upstash/redis";
import { shanghaiDateString } from "@/lib/shanghai-date";

let redisSingleton: Redis | null = null;

export function getVoteRedis(): Redis {
  if (redisSingleton) return redisSingleton;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
  }
  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}

export function voteUserKey(ip: string, ua: string): string {
  const safeIp = ip.replace(/[^a-zA-Z0-9:._-]/g, "").slice(0, 64) || "unknown";
  const safeUa = ua.replace(/[^a-zA-Z0-9:._ -]/g, "").slice(0, 72) || "ua";
  return `${safeIp}|${safeUa}`;
}

export function keyDailyUserVotes(day: string, userKey: string): string {
  return `vote:daily:${day}:${userKey}`;
}

export function keyDailyUserWorkLock(day: string, userKey: string, workId: string): string {
  return `vote:lock:${day}:${userKey}:${workId}`;
}

export function keyWorkDayVotes(day: string, workId: string): string {
  return `vote:workday:${day}:${workId}`;
}

export function keyDirtyWorkDays(): string {
  return "vote:dirty:workdays";
}

export function keyFlushLock(): string {
  return "vote:flush:lock";
}

export function workDayMember(day: string, workId: string): string {
  return `${day}|${workId}`;
}

export function parseWorkDayMember(member: string): { day: string; workId: string } | null {
  const idx = member.indexOf("|");
  if (idx <= 0) return null;
  const day = member.slice(0, idx);
  const workId = member.slice(idx + 1);
  if (!day || !workId) return null;
  return { day, workId };
}

export async function triggerVotesFlush(baseUrl: string): Promise<void> {
  const token = process.env.VOTE_SYNC_TOKEN?.trim();
  const headers: HeadersInit = {};
  if (token) headers["x-vote-sync-token"] = token;
  await fetch(`${baseUrl}/api/votes/flush`, {
    method: "POST",
    headers,
  });
}

export function todayInShanghai(): string {
  return shanghaiDateString();
}
