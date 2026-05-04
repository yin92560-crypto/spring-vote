"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Work } from "./types";
import { getOrCreateClientVoterId } from "./client-voter-id";
import { DAILY_VOTE_LIMIT } from "./vote-config";
import {
  clearStaticWorksJsonCache,
  fetchStaticWorksFromJson,
  filterWorksBySearchKeyword,
  HOME_PAGE_SIZE,
  SEARCH_PAGE_SIZE,
  sortWorksByDisplayNoDesc,
} from "./static-works-from-json";

/** 与 lib/vote-sync 中广播配合：同窗口内刷新作品列表 */
export const VOTE_DATA_CHANGED_EVENT = "spring-vote-refresh";

/** reloadWorks: false 时仅同步今日剩余票（不调 /data.json），避免覆盖前端乐观票数 */
export function emitVoteRefresh(options?: { reloadWorks?: boolean }): void {
  if (typeof window === "undefined") return;
  const reloadWorks = options?.reloadWorks !== false;
  window.dispatchEvent(
    new CustomEvent(VOTE_DATA_CHANGED_EVENT, { detail: { reloadWorks } })
  );
}

function eventReloadWorks(e: Event): boolean {
  if (
    e instanceof CustomEvent &&
    e.detail &&
    typeof (e.detail as { reloadWorks?: boolean }).reloadWorks === "boolean"
  ) {
    return (e.detail as { reloadWorks: boolean }).reloadWorks;
  }
  return true;
}

async function syncTodayVotesFromApi(
  voterId: string,
  signal: AbortSignal
): Promise<{
  remaining: number;
  dailyVoteLimit: number;
  votedWorkIds: string[];
} | null> {
  try {
    const r = await fetch("/api/votes/today", {
      cache: "no-store",
      headers: { "x-voter-id": voterId },
      signal,
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      remaining?: number;
      dailyVoteLimit?: number;
      votedWorkIds?: string[];
    };
    return {
      remaining:
        typeof j.remaining === "number" ? j.remaining : DAILY_VOTE_LIMIT,
      dailyVoteLimit:
        typeof j.dailyVoteLimit === "number" && j.dailyVoteLimit > 0
          ? j.dailyVoteLimit
          : DAILY_VOTE_LIMIT,
      votedWorkIds: Array.isArray(j.votedWorkIds)
        ? j.votedWorkIds.filter((id) => typeof id === "string")
        : [],
    };
  } catch {
    return null;
  }
}

export function useVoteHomeState(searchKeyword?: string): {
  works: Work[] | undefined;
  page: number;
  totalCount: number;
  totalPages: number;
  loadError: string | null;
  remaining: number;
  dailyVoteLimit: number;
  votedWorkIdsFromApi: string[];
  loading: boolean;
  loadingList: boolean;
  refresh: () => Promise<void>;
  setPage: (page: number) => void;
} {
  const [works, setWorks] = useState<Work[] | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(DAILY_VOTE_LIMIT);
  const [dailyVoteLimit, setDailyVoteLimit] = useState(DAILY_VOTE_LIMIT);
  const [votedWorkIdsFromApi, setVotedWorkIdsFromApi] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const setPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, page));
  }, []);

  const keyword = String(searchKeyword ?? "").trim();
  const pageSize = keyword ? SEARCH_PAGE_SIZE : HOME_PAGE_SIZE;

  const syncQuotaOnly = useCallback(async () => {
    const voterId = getOrCreateClientVoterId();
    if (!voterId) return;
    const sync = await syncTodayVotesFromApi(
      voterId,
      new AbortController().signal
    );
    if (sync) {
      setRemaining(sync.remaining);
      setDailyVoteLimit(sync.dailyVoteLimit);
      setVotedWorkIdsFromApi(sync.votedWorkIds);
    }
  }, []);

  const refresh = useCallback(async () => {
    const voterId = getOrCreateClientVoterId();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 60000);
    const isFirstLoad = !hasLoadedOnceRef.current;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setLoadingList(true);
    }
    try {
      const allSorted = sortWorksByDisplayNoDesc(
        await fetchStaticWorksFromJson(controller.signal)
      );
      const filtered = filterWorksBySearchKeyword(allSorted, keyword);
      const total = filtered.length;
      const start = (currentPage - 1) * pageSize;
      const slice = filtered.slice(start, start + pageSize);
      setWorks(slice);
      setTotalCount(Math.max(0, total));
      setLoadError(null);

      if (voterId) {
        const sync = await syncTodayVotesFromApi(voterId, controller.signal);
        if (sync) {
          setRemaining(sync.remaining);
          setDailyVoteLimit(sync.dailyVoteLimit);
          setVotedWorkIdsFromApi(sync.votedWorkIds);
        }
      }
    } catch (err) {
      console.error("useVoteHomeState: /data.json failed", err);
      clearStaticWorksJsonCache();
      setWorks((prev) => prev ?? []);
      setLoadError("网络超时，请重试");
      setVotedWorkIdsFromApi([]);
    } finally {
      hasLoadedOnceRef.current = true;
      window.clearTimeout(timeoutId);
      if (isFirstLoad) {
        setLoading(false);
      } else {
        setLoadingList(false);
      }
    }
  }, [currentPage, keyword, pageSize]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refresh();
      } finally {
        if (cancelled) return;
      }
    })();
    const on = (e: Event) => {
      if (eventReloadWorks(e)) {
        clearStaticWorksJsonCache();
        void refresh();
      } else {
        void syncQuotaOnly();
      }
    };
    window.addEventListener(VOTE_DATA_CHANGED_EVENT, on);
    return () => {
      cancelled = true;
      window.removeEventListener(VOTE_DATA_CHANGED_EVENT, on);
    };
  }, [refresh, syncQuotaOnly]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);

  return {
    works,
    page: currentPage,
    totalCount,
    totalPages,
    loadError,
    remaining,
    dailyVoteLimit,
    votedWorkIdsFromApi,
    loading,
    loadingList,
    refresh,
    setPage,
  };
}

export function useWorksList(): {
  works: Work[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 60000);
    try {
      const sorted = sortWorksByDisplayNoDesc(
        await fetchStaticWorksFromJson(controller.signal)
      );
      setWorks(sorted);
    } catch (err) {
      console.error("useWorksList: /data.json failed", err);
      clearStaticWorksJsonCache();
      setWorks([]);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const on = (e: Event) => {
      if (!eventReloadWorks(e)) return;
      clearStaticWorksJsonCache();
      void refresh();
    };
    window.addEventListener(VOTE_DATA_CHANGED_EVENT, on);
    return () => {
      cancelled = true;
      window.removeEventListener(VOTE_DATA_CHANGED_EVENT, on);
    };
  }, [refresh]);

  return { works, loading, refresh };
}
