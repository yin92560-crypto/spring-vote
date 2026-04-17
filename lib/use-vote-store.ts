"use client";

import { useCallback, useEffect, useState } from "react";
import type { Work } from "./types";
import { getOrCreateClientVoterId } from "./client-voter-id";

/** 与 lib/vote-sync 中广播配合：同窗口内刷新作品列表 */
export const VOTE_DATA_CHANGED_EVENT = "spring-vote-refresh";

export function emitVoteRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VOTE_DATA_CHANGED_EVENT));
}

export function useVoteHomeState(): {
  works: Work[];
  remaining: number;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [works, setWorks] = useState<Work[]>([]);
  const [remaining, setRemaining] = useState(3);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const voterId = getOrCreateClientVoterId();
    const r = await fetch("/api/works", {
      cache: "no-store",
      headers: voterId ? { "x-voter-id": voterId } : undefined,
    });
    if (!r.ok) return;
    const j = (await r.json()) as { works: Work[]; remaining: number };
    if (Array.isArray(j.works)) setWorks(j.works);
    if (typeof j.remaining === "number") setRemaining(j.remaining);
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

  return { works, remaining, loading, refresh };
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
    if (!r.ok) return;
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
