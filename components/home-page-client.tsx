"use client";

import Link from "next/link";
import Image from "next/image";
import { Settings, Trophy } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { WorkDetailModal } from "@/components/work-detail-modal";
import { WorkRemoteImage } from "@/components/work-remote-image";
import { filterWorksBySearch } from "@/lib/work-display";
import { findWorkByDisplayQuery } from "@/lib/work-query-id";
import type { Work } from "@/lib/types";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SpringLoadingIndicator } from "@/components/spring-loading";
import { VotePillButton } from "@/components/vote-pill-button";
import { useI18n } from "@/lib/i18n-context";
import { notifyVoteDataChanged } from "@/lib/vote-sync";
import { useVoteHomeState } from "@/lib/use-vote-store";
import { getOrCreateClientVoterId } from "@/lib/client-voter-id";

const DAILY_VOTE_LIMIT = 3;
const SEARCH_FEATURE_ENABLED = false;

function todayInShanghaiForClient(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function voteCacheKey(): string {
  return `vote:client-used:${todayInShanghaiForClient()}`;
}

function SpringFooter() {
  const { t } = useI18n();
  const rawId = useId();
  const uid = rawId.replace(/:/g, "");

  return (
    <footer className="relative mt-20 w-full max-w-none shrink-0 overflow-hidden">
      <div
        className="pointer-events-none absolute -top-28 left-1/2 h-72 w-[120%] -translate-x-1/2"
        aria-hidden
      >
        <div className="absolute right-[10%] top-6 h-44 w-44 rounded-full bg-amber-100/55 blur-3xl" />
        <div className="absolute right-[26%] top-16 h-28 w-28 rounded-full bg-yellow-50/65 blur-2xl" />
        <div className="absolute left-[6%] top-10 h-36 w-36 rounded-full bg-stone-100/45 blur-3xl" />
        <div className="absolute left-[32%] top-24 h-24 w-24 rounded-full bg-amber-100/40 blur-2xl" />
        <div className="absolute left-1/2 top-0 h-16 w-72 -translate-x-1/2 rounded-full bg-white/50 blur-3xl" />
      </div>

      <svg
        className="relative z-[1] -mb-px block h-[4.5rem] w-full sm:h-[5.5rem]"
        viewBox="0 0 1440 96"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${uid}-wave`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e9f6ea" stopOpacity="0.28" />
            <stop offset="45%" stopColor="#d9ecdf" stopOpacity="0.52" />
            <stop offset="100%" stopColor="#cde3ec" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <path
          fill={`url(#${uid}-wave)`}
          d="M0,56 C200,18 380,92 560,52 C740,12 920,78 1100,46 C1280,14 1380,34 1440,28 L1440,96 L0,96 Z"
        />
      </svg>

      <div className="relative z-[2] border-t border-emerald-200/35 bg-gradient-to-b from-transparent via-[#e8f5e9]/55 to-[#eef7ee]/92 px-6 pb-14 pt-8 text-center backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2 bg-transparent sm:gap-x-4">
          <p className="bg-transparent px-1 text-sm font-medium text-stone-700/85">
            <span className="text-emerald-900/85">{t("footerTagline")}</span>
            <span className="mx-2 text-emerald-800/35" aria-hidden>
              |
            </span>
            {t("footerCopyright")}
          </p>
        </div>
      </div>
    </footer>
  );
}

function HomeLoadingFallbackInner() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-6 pt-[calc(var(--nav-safe)+1rem)] sm:px-6">
      <SpringLoadingIndicator label={t("loadingSpring")} />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass-panel aspect-[4/3] animate-pulse rounded-3xl bg-emerald-50/15"
            />
          ))}
        </div>
    </div>
  );
}

function HomeSiteNav() {
  const { t } = useI18n();
  return (
    <header className="site-nav-fixed">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-0">
        <div className="flex min-w-0 items-center gap-2 pr-1">
          <Image
            src="/huaqin-logo-new.png"
            alt="华勤 Logo"
            width={88}
            height={28}
            className="h-7 w-auto shrink-0 rounded-md"
            priority
            unoptimized
          />
          <p className="min-w-0 font-display text-[0.95rem] font-medium text-stone-800 sm:text-lg">
            <span className="text-gradient-spring-title">{t("title")}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Link
            href="/rank"
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-emerald-200/70 bg-amber-50/70 px-2.5 py-2 text-xs font-medium shadow-sm backdrop-blur-md transition-colors hover:bg-amber-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300/50 sm:gap-1.5 sm:px-3 sm:text-sm"
          >
            <Trophy
              className="size-4 shrink-0 text-stone-800/90"
              strokeWidth={2}
              aria-hidden
            />
            <span className="text-stone-700">{t("rank")}</span>
          </Link>
          <Link
            href="/admin"
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-emerald-200/70 bg-amber-50/70 px-2.5 py-2 text-xs font-medium shadow-sm backdrop-blur-md transition-colors hover:bg-amber-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300/50 sm:gap-1.5 sm:px-3 sm:text-sm"
          >
            <Settings
              className="size-4 shrink-0 text-stone-800/90"
              strokeWidth={2}
              aria-hidden
            />
            <span className="text-stone-700">{t("admin")}</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

function HomeLoadingFallback() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <HomeSiteNav />
      <HomeLoadingFallbackInner />
      <SpringFooter />
    </div>
  );
}

function HomePageContent() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { works, remaining, loading, refresh } = useVoteHomeState();
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("");
  const [detailWork, setDetailWork] = useState<Work | null>(null);
  const [votePendingWorkId, setVotePendingWorkId] = useState<string | null>(null);
  const [localUsedVotes, setLocalUsedVotes] = useState(0);
  /** 避免「先 setState 再 replaceQuery」时 effect 因 id 尚未写入而误关弹窗 */
  const skipUrlSyncOnceRef = useRef(false);
  const voteCooldownUntilRef = useRef<Map<string, number>>(new Map());

  const filteredWorks = useMemo(() => {
    if (!SEARCH_FEATURE_ENABLED) return works;
    return filterWorksBySearch(works, searchQuery);
  }, [works, searchQuery]);
  const pageSize = 18;
  const totalPages = Math.max(1, Math.ceil(filteredWorks.length / pageSize));
  const pagedWorks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredWorks.slice(start, start + pageSize);
  }, [filteredWorks, page]);
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  const shareUrl = useMemo(() => {
    if (!detailWork) return "";
    if (typeof window === "undefined") return "";
    const p = new URLSearchParams();
    p.set("id", detailWork.displayNo);
    return `${window.location.origin}${pathname}?${p.toString()}`;
  }, [detailWork, pathname]);

  const replaceQuery = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(searchParams.toString());
    mutate(p);
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const openDetail = (w: Work) => {
    skipUrlSyncOnceRef.current = true;
    setDetailWork(w);
    replaceQuery((p) => p.set("id", w.displayNo));
  };

  const closeDetail = () => {
    setDetailWork(null);
    replaceQuery((p) => {
      p.delete("id");
    });
  };

  useEffect(() => {
    if (works.length === 0) return;
    if (skipUrlSyncOnceRef.current) {
      skipUrlSyncOnceRef.current = false;
      return;
    }
    const idParam = searchParams.get("id");
    if (!idParam) {
      setDetailWork(null);
      return;
    }
    const w = findWorkByDisplayQuery(works, idParam);
    setDetailWork(w ?? null);
  }, [searchParams, works]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cached = Number(window.localStorage.getItem(voteCacheKey()) ?? "0");
      if (Number.isFinite(cached) && cached >= 0) {
        setLocalUsedVotes(Math.min(DAILY_VOTE_LIMIT, cached));
      }
    } catch {
      /* ignore */
    }
    void fetch("/api/stats/pv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageKey: "home" }),
    });
  }, []);

  useEffect(() => {
    const serverUsed = Math.max(0, DAILY_VOTE_LIMIT - remaining);
    setLocalUsedVotes(serverUsed);
    try {
      window.localStorage.setItem(voteCacheKey(), String(serverUsed));
    } catch {
      /* ignore */
    }
  }, [remaining]);

  useEffect(() => {
    if (!SEARCH_FEATURE_ENABLED && searchQuery) {
      setSearchQuery("");
      return;
    }
    setPage(1);
    setJumpPage("");
  }, [searchQuery]);

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(prev, 1), totalPages));
  }, [totalPages]);

  const requestVoteOnce = async (workId: string) => {
    const voterId = getOrCreateClientVoterId();
    return fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workId, voterId }),
    });
  };

  const shouldRetryVote = (res: Response | null, errMsg?: string): boolean => {
    if (res && (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504)) {
      return true;
    }
    if (!errMsg) return false;
    return /connection|too many|timeout|temporar/i.test(errMsg);
  };

  const performVote = async (workId: string) => {
    let res: Response;
    let j: { ok?: boolean; reason?: string; error?: string };
    try {
      res = await requestVoteOnce(workId);
      j = (await res.json()) as { ok?: boolean; reason?: string; error?: string };
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        res = await requestVoteOnce(workId);
        j = (await res.json()) as { ok?: boolean; reason?: string; error?: string };
      } catch {
        setToast(t("toastRequestFail"));
        setTimeout(() => setToast(null), 2400);
        return false;
      }
    }

    if (!res.ok && shouldRetryVote(res, j.error)) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const retryRes = await requestVoteOnce(workId);
        const retryJson = (await retryRes.json()) as {
          ok?: boolean;
          reason?: string;
          error?: string;
        };
        res = retryRes;
        j = retryJson;
      } catch {
        setToast(t("toastRequestFail"));
        setTimeout(() => setToast(null), 2400);
        return false;
      }
    }

    if (!res.ok) {
      setToast(j.error ?? t("toastRequestFail"));
      setTimeout(() => setToast(null), 2400);
      return false;
    }
    if (j.ok) {
      let nextUsed = DAILY_VOTE_LIMIT;
      setLocalUsedVotes((prev) => {
        nextUsed = Math.min(DAILY_VOTE_LIMIT, prev + 1);
        return nextUsed;
      });
      try {
        window.localStorage.setItem(voteCacheKey(), String(nextUsed));
      } catch {
        /* ignore */
      }
      setToast(t("toastVoteOk"));
      notifyVoteDataChanged();
      router.refresh();
      await refresh();
      return true;
    }
    setToast(j.reason ?? t("toastVoteFail"));
    setTimeout(() => setToast(null), 2400);
    return false;
  };

  const reserveVoteCooldown = (workId: string): boolean => {
    const now = Date.now();
    const until = voteCooldownUntilRef.current.get(workId) ?? 0;
    if (until > now) return false;
    voteCooldownUntilRef.current.set(workId, now + 5000);
    return true;
  };

  const submitVote = async (workId: string) => {
    if (votePendingWorkId) return;
    if (localUsedVotes >= DAILY_VOTE_LIMIT) {
      setToast("今日票数已用完");
      setTimeout(() => setToast(null), 2000);
      return;
    }
    if (!reserveVoteCooldown(workId)) {
      setToast("请求过于频繁，请 5 秒后重试");
      setTimeout(() => setToast(null), 2000);
      return;
    }

    setVotePendingWorkId(workId);
    try {
      await performVote(workId);
    } finally {
      setVotePendingWorkId(null);
      setTimeout(() => setToast(null), 2400);
    }
  };

  const voteFromCard = async (workId: string) => {
    await submitVote(workId);
  };

  const voteFromModal = async () => {
    if (!detailWork) return;
    await submitVote(detailWork.id);
  };

  const goToPage = (target: number) => {
    if (Number.isNaN(target)) return;
    setPage(Math.min(totalPages, Math.max(1, target)));
  };

  const titleToneClass =
    locale === "ja"
        ? "text-[2.25rem] sm:text-5xl lg:text-6xl leading-[1.16] sm:leading-[1.12] tracking-[0.01em]"
        : "text-[2.15rem] sm:text-5xl lg:text-6xl leading-[1.16] sm:leading-[1.12] tracking-[0.005em]";
  const titleWidthClass = locale === "zh" ? "max-w-4xl" : "max-w-5xl";
  const descTextClass =
    locale === "zh"
      ? "text-lg sm:text-xl"
      : "text-base sm:text-lg";
  const ruleTextClass =
    locale === "zh"
      ? "text-base sm:text-lg"
      : "text-sm sm:text-base";
  const bannerTitleLines =
    locale === "zh"
      ? ["2026华勤全球员工", "春日摄影大赛"]
      : [t("subtitle")];

  if (loading) {
    return <HomeLoadingFallback />;
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <HomeSiteNav />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-[calc(var(--nav-safe)+1.15rem)] sm:px-6 sm:pt-[calc(var(--nav-safe)+1.25rem)]">
        <section className="text-center">
          <div className={`relative mx-auto ${titleWidthClass} px-2 py-2 sm:px-4 sm:py-4`}>
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[220px] w-[min(94vw,860px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.34)_38%,rgba(255,255,255,0.08)_65%,rgba(255,255,255,0)_100%)] blur-[2px]" />
            {locale === "zh" ? (
              <div className="font-display text-balance">
                <h1
                  className="relative z-[1] text-[clamp(2.35rem,8.4vw,5rem)] font-black leading-[1.1] tracking-[2px]"
                  style={{
                    fontFamily: '"STKaiti", "KaiTi", "Noto Serif SC", serif',
                    color: "#f7f5ef",
                    textShadow:
                      "0 2px 2px rgba(0,0,0,0.34), 2px 2px 4px rgba(0,0,0,0.32), 0 0 10px rgba(255,255,255,0.58)",
                  }}
                >
                  {bannerTitleLines[0]}
                </h1>
                <h2
                  className="relative z-[1] mb-2 mt-2 text-[clamp(2.1rem,7.6vw,4.5rem)] font-black leading-[1.1] tracking-[2px]"
                  style={{
                    fontFamily: '"STKaiti", "KaiTi", "Noto Serif SC", serif',
                    color: "#f7f5ef",
                    textShadow:
                      "0 2px 2px rgba(0,0,0,0.34), 2px 2px 4px rgba(0,0,0,0.32), 0 0 10px rgba(255,255,255,0.58)",
                  }}
                >
                  {bannerTitleLines[1]}
                </h2>
              </div>
            ) : (
              <h1
                className={`relative z-[1] font-display font-black ${titleToneClass} text-balance`}
                style={{
                  fontFamily: '"STKaiti", "KaiTi", "Noto Serif SC", serif',
                  color: "#f7f5ef",
                  textShadow:
                    "0 2px 2px rgba(0,0,0,0.34), 2px 2px 4px rgba(0,0,0,0.32), 0 0 10px rgba(255,255,255,0.58)",
                }}
              >
                {bannerTitleLines[0]}
              </h1>
            )}
            <p className={`mx-auto mt-4 max-w-2xl text-pretty font-medium leading-[1.8] text-[#2c2b27]/88 drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] ${descTextClass}`}>
              {t("heroDesc")}
            </p>
            <p className={`mx-auto mt-1.5 max-w-2xl font-medium leading-[1.8] text-[#2c2b27]/88 drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] ${ruleTextClass}`}>
              {t("voteRules")}
            </p>
            <p className="mt-5 text-base font-semibold text-[#3b372f] drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)]">
              {t("remainingVotes")}{" "}
              <span className="tabular-nums text-xl text-[#3b372f]">{remaining}</span>
              <span className="text-[#3b372f]/85"> / 3</span>
            </p>
          </div>
        </section>

        {toast && (
          <div
            role="status"
            className="glass-panel fixed bottom-8 left-1/2 z-[110] -translate-x-1/2 rounded-full px-6 py-2.5 text-sm text-stone-800 shadow-lg transition-all duration-300 ease-out"
          >
            {toast}
          </div>
        )}

        <WorkDetailModal
          work={detailWork}
          navigableWorks={filteredWorks}
          onNavigateTo={openDetail}
          shareUrl={shareUrl}
          onClose={closeDetail}
          remaining={remaining}
          voting={Boolean(votePendingWorkId)}
          onVote={() => void voteFromModal()}
          onShareCopied={() => {
            setToast(t("shareCopied"));
            setTimeout(() => setToast(null), 3200);
          }}
          onShareCopyFailed={() => {
            setToast(t("shareFailed"));
            setTimeout(() => setToast(null), 3200);
          }}
        />

        <section className="mt-16">
          {works.length === 0 ? (
            <div className="glass-panel rounded-3xl px-8 py-16 text-center">
              <p className="text-lg text-stone-700/85">{t("noWorks")}</p>
              <p className="mt-2 text-sm text-stone-800/65">{t("noWorksHint")}</p>
              <Link
                href="/admin"
                className="btn-sakura mt-8 inline-flex rounded-full px-8 py-3 text-sm font-medium text-white shadow-md"
              >
                {t("goAdmin")}
              </Link>
            </div>
          ) : (
            <>
              <div className="mx-auto max-w-xl">
                <p className="mt-2 text-center text-xs text-stone-800/55">
                  {t("worksTotal", { count: works.length })}
                </p>
              </div>

              {filteredWorks.length === 0 ? (
                <div className="glass-panel mt-8 rounded-3xl px-8 py-14 text-center">
                  <p className="text-stone-800/85">{t("noMatch")}</p>
                  <p className="mt-2 text-sm text-stone-800/65">{t("noMatchHint")}</p>
                </div>
              ) : (
                <>
                  <ul className="mt-7 grid gap-5 sm:mt-8 sm:gap-7 sm:grid-cols-2 lg:grid-cols-3">
                    {pagedWorks.map((w, idx) => (
                      <li key={w.id}>
                        <article className="glass-panel group flex flex-col overflow-hidden rounded-[1.6rem] shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-white/95 hover:backdrop-blur-xl hover:shadow-2xl">
                          <button
                            type="button"
                            onClick={() => openDetail(w)}
                            className="relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden bg-stone-100/50 text-left outline-none ring-stone-300/40 transition-all duration-300 ease-out focus-visible:ring-2"
                          >
                            <div className="pointer-events-none absolute left-3 top-3 z-[1] rounded-lg bg-amber-50/86 px-2.5 py-1 text-xs font-semibold tabular-nums tracking-wide text-stone-700 shadow-sm backdrop-blur-sm">
                              No.{w.displayNo}
                            </div>
                            <WorkRemoteImage
                              src={w.imageUrl}
                              index={idx}
                              alt={`${w.workTitle || w.title} (${t("displayNoLabel")} ${w.displayNo})`}
                              className="absolute inset-0 h-full w-full"
                              imgClassName="object-cover transition-transform duration-500 ease-out will-change-transform group-hover:scale-105"
                            />
                            <div className="card-caption-overlay pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3 pt-12">
                              <p className="text-xs font-semibold drop-shadow-md">
                                <span className="card-badge-no text-stone-700/90">
                                  {t("displayNoLabel")} {w.displayNo}
                                </span>
                              </p>
                              <p className="truncate text-lg font-medium text-white drop-shadow-md">
                                {w.workTitle || w.title}
                              </p>
                              <p className="mt-1 text-[11px] text-white/90 drop-shadow">
                                {t("viewDetailHint")}
                              </p>
                            </div>
                          </button>
                          <div className="flex items-center justify-between gap-3 px-4 py-4">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-[#4a2f22]">
                                {w.workTitle || w.title}
                              </p>
                              <p className="mt-0.5 truncate text-xs font-semibold text-[#4a2f22]/80">
                                {t("authorLabel")}：{w.authorName || "-"}
                              </p>
                              <p className="mt-1 text-sm text-stone-700/85">
                                {t("votesLabel")}{" "}
                                <strong className="text-stone-800">{w.votes}</strong>
                              </p>
                            </div>
                            <VotePillButton
                              disabled={remaining <= 0 || Boolean(votePendingWorkId)}
                              loading={Boolean(votePendingWorkId)}
                              onVote={() => voteFromCard(w.id)}
                              className="min-w-[80px] shrink-0"
                            >
                              {votePendingWorkId ? t("voteSubmitting") : t("voteCard")}
                            </VotePillButton>
                          </div>
                        </article>
                      </li>
                    ))}
                  </ul>
                  <div className="glass-panel mt-8 flex flex-wrap items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm">
                  <button
                    type="button"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                    className="rounded-full border border-emerald-200/70 bg-white/70 px-3 py-1.5 font-medium text-[#4a2f22] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    上一页
                  </button>
                  {pageNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => goToPage(n)}
                      className={`rounded-full border px-3 py-1.5 font-semibold ${
                        n === page
                          ? "border-amber-200 bg-amber-100/80 text-[#4a2f22]"
                          : "border-emerald-200/70 bg-white/70 text-[#4a2f22]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                    className="rounded-full border border-emerald-200/70 bg-white/70 px-3 py-1.5 font-medium text-[#4a2f22] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    下一页
                  </button>
                  <div className="ml-1 inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-white/70 px-2 py-1">
                    <span className="text-xs font-medium text-[#4a2f22]">
                      跳转到第
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={jumpPage}
                      onChange={(e) => setJumpPage(e.target.value)}
                      className="w-14 rounded-md border border-emerald-200 bg-white/50 px-2 py-1 text-center text-xs font-semibold text-[#4a2f22] outline-none"
                    />
                    <span className="text-xs font-medium text-[#4a2f22]">页</span>
                    <button
                      type="button"
                      onClick={() => {
                        const n = Number.parseInt(jumpPage, 10);
                        if (!Number.isNaN(n)) goToPage(n);
                      }}
                      className="rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-[#4a2f22]"
                    >
                      确认
                    </button>
                  </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>

      <SpringFooter />
    </div>
  );
}

export function HomePageClient() {
  return (
    <Suspense fallback={<HomeLoadingFallback />}>
      <HomePageContent />
    </Suspense>
  );
}
