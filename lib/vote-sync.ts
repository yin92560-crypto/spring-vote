"use client";

import { emitVoteRefresh } from "@/lib/use-vote-store";

/** 与其它标签页共享，用于排行榜等页面触发 router.refresh */
export const VOTE_BROADCAST_CHANNEL = "spring-vote-sync";

/**
 * 投票成功或管理端变更票数/作品后调用：通知首页 hooks 刷新，并广播给其它标签页。
 * 调用方宜同时执行 `router.refresh()` 以刷新服务端组件（如 /rank）。
 */
export function notifyVoteDataChanged(): void {
  emitVoteRefresh();
  if (typeof window === "undefined") return;
  try {
    const bc = new BroadcastChannel(VOTE_BROADCAST_CHANNEL);
    bc.postMessage({ type: "vote-data-changed" });
    bc.close();
  } catch {
    /* 忽略不支持 BroadcastChannel 的环境 */
  }
}
