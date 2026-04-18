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
  remaining: number;
  dailyVoteLimit: number;
  votedWorkIdsFromApi: string[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [works, setWorks] = useState<Work[] | undefined>(undefined);
  const [remaining, setRemaining] = useState(DAILY_VOTE_LIMIT);
  const [dailyVoteLimit, setDailyVoteLimit] = useState(DAILY_VOTE_LIMIT);
  const [votedWorkIdsFromApi, setVotedWorkIdsFromApi] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const refresh = useCallback(async () => {
    const voterId = getOrCreateClientVoterId();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const r = await fetch("/api/works", {
          cache: "no-store",
          headers: voterId ? { "x-voter-id": voterId } : undefined,
        });
        if (!r.ok) {
          throw new Error(`HTTP ${r.status} ${r.statusText}`);
        }
        const j = (await r.json()) as {
          works: Work[];
          remaining: number;
          dailyVoteLimit?: number;
          votedWorkIds?: string[];
        };
        if (Array.isArray(j.works)) setWorks(j.works);
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
        return;
      } catch (err) {
        if (attempt >= 3) {
          console.error("useVoteHomeState: /api/works failed after retries", err);
          return;
        }
        await sleep(350 * attempt);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
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
    remaining,
    dailyVoteLimit,
    votedWorkIdsFromApi,
    loading,
    refresh,
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
    const r = await fetch("/api/works", {
      cache: "no-store",
      headers: voterId ? { "x-voter-id": voterId } : undefined,
    });
    if (!r.ok) {
      console.error("useWorksList: /api/works failed", r.status, r.statusText);
      return;
    }
    const j = (await r.json()) as { works: Work[] };
    if (Array.isArray(j.works)) setWorks(j.works);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
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
