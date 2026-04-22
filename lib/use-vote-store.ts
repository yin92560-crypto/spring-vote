"use client";

import { useCallback, useEffect, useState } from "react";
import type { Work } from "./types";
import { getOrCreateClientVoterId } from "./client-voter-id";
import { DAILY_VOTE_LIMIT } from "./vote-config";

/** 与 lib/vote-sync 中广播配合：同窗口内刷新作品列表 */
export const VOTE_DATA_CHANGED_EVENT = "spring-vote-refresh";

export function emitVoteRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VOTE_DATA_CHANGED_EVENT));
}

export function useVoteHomeState(): {
  works: Work[] | undefined;
  hasMore: boolean;
  loadingMore: boolean;
  remaining: number;
  dailyVoteLimit: number;
  votedWorkIdsFromApi: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
} {
  const [works, setWorks] = useState<Work[] | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [remaining, setRemaining] = useState(DAILY_VOTE_LIMIT);
  const [dailyVoteLimit, setDailyVoteLimit] = useState(DAILY_VOTE_LIMIT);
  const [votedWorkIdsFromApi, setVotedWorkIdsFromApi] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const refresh = useCallback(async () => {
    const voterId = getOrCreateClientVoterId();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 8000);
      try {
        const r = await fetch("/api/works?page=1&pageSize=24", {
          cache: "no-store",
          headers: voterId ? { "x-voter-id": voterId } : undefined,
          signal: controller.signal,
        });
        if (!r.ok) {
          throw new Error(`HTTP ${r.status} ${r.statusText}`);
        }
        const j = (await r.json()) as {
          works: Work[];
          hasMore?: boolean;
          remaining: number;
          dailyVoteLimit?: number;
          votedWorkIds?: string[];
        };
        if (Array.isArray(j.works)) setWorks(j.works);
        setCurrentPage(1);
        setHasMore(Boolean(j.hasMore));
        if (typeof j.remaining === "number") setRemaining(j.remaining);
        if (typeof j.dailyVoteLimit === "number" && j.dailyVoteLimit > 0) {
          setDailyVoteLimit(j.dailyVoteLimit);
        } else {
          setDailyVoteLimit(DAILY_VOTE_LIMIT);
        }
        setVotedWorkIdsFromApi(
          Array.isArray(j.votedWorkIds)
            ? j.votedWorkIds.filter((id) => typeof id === "string")
            : []
        );
        window.clearTimeout(timeoutId);
        return;
      } catch (err) {
        window.clearTimeout(timeoutId);
        if (attempt >= 3) {
          console.error("useVoteHomeState: /api/works failed after retries", err);
          setWorks((prev) => prev ?? []);
          setVotedWorkIdsFromApi([]);
          return;
        }
        await sleep(350 * attempt);
      }
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    const voterId = getOrCreateClientVoterId();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    setLoadingMore(true);
    try {
      const r = await fetch(`/api/works?page=${nextPage}&pageSize=24`, {
        cache: "no-store",
        headers: voterId ? { "x-voter-id": voterId } : undefined,
        signal: controller.signal,
      });
      if (!r.ok) {
        throw new Error(`HTTP ${r.status} ${r.statusText}`);
      }
      const j = (await r.json()) as { works?: Work[]; hasMore?: boolean };
      const nextWorks = Array.isArray(j.works) ? j.works : [];
      if (nextWorks.length > 0) {
        setWorks((prev) => {
          const prevList = prev ?? [];
          const seen = new Set(prevList.map((w) => w.id));
          const merged = [...prevList];
          for (const item of nextWorks) {
            if (!seen.has(item.id)) {
              merged.push(item);
              seen.add(item.id);
            }
          }
          return merged;
        });
      }
      setCurrentPage(nextPage);
      setHasMore(Boolean(j.hasMore));
    } catch (err) {
      console.error("useVoteHomeState: load more failed", err);
    } finally {
      window.clearTimeout(timeoutId);
      setLoadingMore(false);
    }
  }, [currentPage, hasMore, loadingMore]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const on = () => {
      void refresh();
    };
    window.addEventListener(VOTE_DATA_CHANGED_EVENT, on);
    const timer = window.setInterval(() => {
      void refresh();
    }, 300000);
    return () => {
      cancelled = true;
      window.removeEventListener(VOTE_DATA_CHANGED_EVENT, on);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return {
    works,
    hasMore,
    loadingMore,
    remaining,
    dailyVoteLimit,
    votedWorkIdsFromApi,
    loading,
    refresh,
    loadMore,
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
    const voterId = getOrCreateClientVoterId();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetch("/api/works", {
        cache: "no-store",
        headers: voterId ? { "x-voter-id": voterId } : undefined,
        signal: controller.signal,
      });
      if (!r.ok) {
        console.error("useWorksList: /api/works failed", r.status, r.statusText);
        setWorks([]);
        return;
      }
      const j = (await r.json()) as { works: Work[] };
      if (Array.isArray(j.works)) setWorks(j.works);
    } catch (err) {
      console.error("useWorksList: /api/works request failed", err);
      setWorks([]);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const on = () => {
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
