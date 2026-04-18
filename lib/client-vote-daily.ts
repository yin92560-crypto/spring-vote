"use client";

import { getOrCreateClientVoterId } from "@/lib/client-voter-id";
import {
  appendHuaqinVoteRecord,
  getTodayVoteStateForVoter,
} from "@/lib/huaqin-voted-list";

/** 今日已用票数（0–3），以 huaqin_voted_list 为准 */
export function getClientDailyVoteUsed(): number {
  const id = getOrCreateClientVoterId();
  if (!id) return 0;
  return getTodayVoteStateForVoter(id).used;
}

/** 投票成功后追加记录并返回新的已用票数 */
export function incrementClientDailyVoteUsed(workId: string): number {
  const id = getOrCreateClientVoterId();
  if (!id) return 0;
  return appendHuaqinVoteRecord(workId, id);
}
