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

function normalizeWorks(list: unknown[]): Work[] {
  const toDisplayNo = (raw: unknown): string => {
    const digits = String(raw ?? "").replace(/\D/g, "");
    if (!digits) return "";
    return String(Number(digits)).padStart(3, "0");
  };
  return list.map((item) => {
    const row = item as {
      id?: unknown;
      displayNo?: unknown;
      title?: unknown;
      workTitle?: unknown;
      authorName?: unknown;
      imageUrl?: unknown;
      vote_count?: unknown;
      votes?: unknown;
    };
    return {
      id: String(row.id ?? ""),
      displayNo: toDisplayNo(row.displayNo),
      title: String(row.title ?? ""),
      workTitle: String(row.workTitle ?? row.title ?? ""),
      authorName: String(row.authorName ?? ""),
      imageUrl: String(row.imageUrl ?? ""),
      votes: Number(row.vote_count ?? row.votes ?? 0),
      createdAt: "",
    };
  });
}

export function useVoteHomeState(): {
  works: Work[] | undefined;
  page: number;
  totalCount: number;
  totalPages: number;
  loadError: string | null;
  remaining: number;
  dailyVoteLimit: number;
  votedWorkIdsFromApi: string[];
  loading: boolean;
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

  const refresh = useCallback(async () => {
    const voterId = getOrCreateClientVoterId();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch(`/api/works?page=${currentPage}&limit=24`, {
        cache: "no-store",
        headers: voterId ? { "x-voter-id": voterId } : undefined,
        signal: controller.signal,
      });
      if (!r.ok) {
        throw new Error(`HTTP ${r.status} ${r.statusText}`);
      }
      const j = (await r.json()) as {
        data?: unknown[];
        works?: unknown[];
        totalCount?: number;
        remaining?: number;
        dailyVoteLimit?: number;
        votedWorkIds?: string[];
      };
      const rows = Array.isArray(j.data)
        ? j.data
        : Array.isArray(j.works)
          ? j.works
          : [];
      setWorks(normalizeWorks(rows));
      setTotalCount(Math.max(0, Number(j.totalCount ?? 0)));
      setLoadError(null);
      if (typeof j.remaining === "number") setRemaining(j.remaining);
      if (typeof j.dailyVoteLimit === "number" && j.dailyVoteLimit > 0) {
        setDailyVoteLimit(j.dailyVoteLimit);
      }
      setVotedWorkIdsFromApi(
        Array.isArray(j.votedWorkIds)
          ? j.votedWorkIds.filter((id) => typeof id === "string")
          : []
      );
    } catch (err) {
      console.error("useVoteHomeState: /api/works failed", err);
      setWorks((prev) => prev ?? []);
      setLoadError("网络超时，请重试");
      setVotedWorkIdsFromApi([]);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [currentPage]);

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

  return {
    works,
    page: currentPage,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / 24)),
    loadError,
    remaining,
    dailyVoteLimit,
    votedWorkIdsFromApi,
    loading,
    refresh,
    setPage: (page: number) => setCurrentPage(Math.max(1, page)),
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
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch("/api/works?all=1", {
        cache: "no-store",
        headers: voterId ? { "x-voter-id": voterId } : undefined,
        signal: controller.signal,
      });
      if (!r.ok) {
        console.error("useWorksList: /api/works failed", r.status, r.statusText);
        setWorks([]);
        return;
      }
      const j = (await r.json()) as { data?: unknown[]; works?: unknown[] };
      const rows = Array.isArray(j.data)
        ? j.data
        : Array.isArray(j.works)
          ? j.works
          : [];
      setWorks(normalizeWorks(rows));
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
