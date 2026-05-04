"use client";

import { emitVoteRefresh } from "@/lib/use-vote-store";

/** 与其它标签页共享，用于排行榜等页面触发 router.refresh */
export const VOTE_BROADCAST_CHANNEL = "spring-vote-sync";

/**
 * 投票成功或管理端变更票数/作品后调用：通知首页 hooks 刷新，并广播给其它标签页。
 * 调用方宜同时执行 `router.refresh()` 以刷新服务端组件（如 /rank）。
 */
/** 仅同步今日剩余票数等，不重新拉取 /data.json（避免覆盖乐观票数） */
export function notifyVoteQuotaChanged(): void {
  emitVoteRefresh({ reloadWorks: false });
  if (typeof window === "undefined") return;
  try {
    const bc = new BroadcastChannel(VOTE_BROADCAST_CHANNEL);
    bc.postMessage({ type: "vote-quota-changed" });
    bc.close();
  } catch {
    /* ignore */
  }
}

/** 作品列表或票数汇总需与静态文件/后台一致时调用（会触发重新 fetch /data.json） */
export function notifyVoteDataChanged(): void {
  emitVoteRefresh({ reloadWorks: true });
  if (typeof window === "undefined") return;
  try {
    const bc = new BroadcastChannel(VOTE_BROADCAST_CHANNEL);
    bc.postMessage({ type: "vote-data-changed" });
    bc.close();
  } catch {
    /* 忽略不支持 BroadcastChannel 的环境 */
  }
}
