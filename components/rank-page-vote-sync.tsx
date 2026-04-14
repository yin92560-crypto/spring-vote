"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { VOTE_BROADCAST_CHANNEL } from "@/lib/vote-sync";
import { VOTE_DATA_CHANGED_EVENT } from "@/lib/use-vote-store";

/**
 * 挂在 /rank：监听投票/管理端变更，调用 router.refresh() 拉取最新排行榜。
 * 同窗口事件 + 跨标签 BroadcastChannel；返回页面时若窗口重新获得焦点再刷新一次（简单兜底）。
 */
export function RankPageVoteSync() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      router.refresh();
    };

    window.addEventListener(VOTE_DATA_CHANGED_EVENT, refresh);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(VOTE_BROADCAST_CHANNEL);
      bc.onmessage = refresh;
    } catch {
      /* ignore */
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    // 兜底实时刷新：页面停留期间每 8 秒刷新一次排行榜
    const timer = window.setInterval(refresh, 8000);

    return () => {
      window.removeEventListener(VOTE_DATA_CHANGED_EVENT, refresh);
      bc?.close();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [router]);

  return null;
}
