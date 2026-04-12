"use client";

import Link from "next/link";
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
import { filterWorksBySearch } from "@/lib/work-display";
import { findWorkByDisplayQuery } from "@/lib/work-query-id";
import type { Work } from "@/lib/types";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SpringLoadingIndicator } from "@/components/spring-loading";
import { VotePillButton } from "@/components/vote-pill-button";
import { useI18n } from "@/lib/i18n-context";
import { notifyVoteDataChanged } from "@/lib/vote-sync";
import { useVoteHomeState } from "@/lib/use-vote-store";

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
        <div className="absolute left-[6%] top-10 h-36 w-36 rounded-full bg-rose-100/45 blur-3xl" />
        <div className="absolute left-[32%] top-24 h-24 w-24 rounded-full bg-pink-100/40 blur-2xl" />
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
            <stop offset="0%" stopColor="#fce7ef" stopOpacity="0.2" />
            <stop offset="45%" stopColor="#f5d0e3" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f0c4db" stopOpacity="0.72" />
          </linearGradient>
        </defs>
        <path
          fill={`url(#${uid}-wave)`}
          d="M0,56 C200,18 380,92 560,52 C740,12 920,78 1100,46 C1280,14 1380,34 1440,28 L1440,96 L0,96 Z"
        />
      </svg>

      <div className="relative z-[2] border-t border-emerald-200/35 bg-gradient-to-b from-transparent via-[#e8f5e9]/55 to-[#fdf8fc]/92 px-6 pb-14 pt-8 text-center backdrop-blur-sm">
        <p className="text-sm font-medium text-rose-900/80 drop-shadow-sm">
          <span className="text-emerald-900/85">{t("footerTagline")}</span>
          <span className="mx-2 text-emerald-800/35" aria-hidden>
            |
          </span>
          {t("footerCopyright")}
        </p>
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

function HomeLoadingFallback() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="site-nav-fixed">
        <div className="mx-auto h-14 max-w-6xl bg-gradient-to-r from-emerald-100/20 via-white/25 to-rose-100/20 px-6" />
      </header>
      <HomeLoadingFallbackInner />
      <SpringFooter />
    </div>
  );
}

function HomePageContent() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { works, remaining, loading, refresh } = useVoteHomeState();
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailWork, setDetailWork] = useState<Work | null>(null);
  const [voteModalPending, setVoteModalPending] = useState(false);
  /** 避免「先 setState 再 replaceQuery」时 effect 因 id 尚未写入而误关弹窗 */
  const skipUrlSyncOnceRef = useRef(false);

  const filteredWorks = useMemo(
    () => filterWorksBySearch(works, searchQuery),
    [works, searchQuery]
  );

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

  const performVote = async (workId: string) => {
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workId }),
    });
    const j = (await res.json()) as {
      ok?: boolean;
      reason?: string;
      error?: string;
    };
    if (!res.ok) {
      setToast(j.error ?? t("toastRequestFail"));
      setTimeout(() => setToast(null), 2400);
      return false;
    }
    if (j.ok) {
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

  const voteFromCard = async (workId: string) => {
    await performVote(workId);
    setTimeout(() => setToast(null), 2400);
  };

  const voteFromModal = async () => {
    if (!detailWork) return;
    setVoteModalPending(true);
    try {
      await performVote(detailWork.id);
    } finally {
      setVoteModalPending(false);
      setTimeout(() => setToast(null), 2400);
    }
  };

  if (loading) {
    return <HomeLoadingFallback />;
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="site-nav-fixed">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400/90 to-sky-300/90 text-lg shadow-inner ring-1 ring-white/50">
              🌸
            </span>
            <div>
              <p className="text-sm font-medium text-rose-900/80">
                {t("remainingVotes")}
              </p>
              <p className="text-2xl font-semibold tabular-nums text-rose-950">
                {remaining}
                <span className="text-base font-normal text-rose-800/60">
                  {" "}
                  / 3
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <LanguageSwitcher />
            <Link
              href="/rank"
              className="inline-flex items-center justify-center rounded-full border border-pink-300/75 bg-white/50 px-5 py-2.5 text-sm font-medium text-rose-900 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:border-pink-400/90 hover:bg-white/85 hover:shadow-md"
            >
              {t("rank")}
            </Link>
            <Link
              href="/admin"
              className="btn-sakura inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-md"
            >
              {t("admin")}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-8 pt-[calc(var(--nav-safe)+1rem)] sm:px-6">
        <section className="text-center">
          <h1 className="font-display text-4xl font-normal leading-tight sm:text-5xl">
            <span className="text-gradient-spring-title">{t("title")}</span>
          </h1>
          <p className="mt-3 text-lg font-medium leading-snug text-rose-900/90 sm:text-xl">
            {t("subtitle")}
          </p>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-rose-900/75">
            {t("heroDesc")}
          </p>
        </section>

        {toast && (
          <div
            role="status"
            className="glass-panel fixed bottom-8 left-1/2 z-[110] -translate-x-1/2 rounded-full px-6 py-2.5 text-sm text-rose-900 shadow-lg transition-all duration-300 ease-out"
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
          voting={voteModalPending}
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

        <section className="mt-14">
          {works.length === 0 ? (
            <div className="glass-panel rounded-3xl px-8 py-16 text-center">
              <p className="text-lg text-rose-900/80">{t("noWorks")}</p>
              <p className="mt-2 text-sm text-rose-800/65">{t("noWorksHint")}</p>
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
                <label htmlFor="work-search" className="sr-only">
                  {t("searchAria")}
                </label>
                <div className="search-glow glass-panel flex items-center gap-3 rounded-2xl border border-emerald-100/45 bg-gradient-to-r from-white/55 via-emerald-50/25 to-rose-50/40 px-4 py-3 backdrop-blur-md">
                  <span
                    className="shrink-0 text-lg text-rose-400/90"
                    aria-hidden
                  >
                    🔍
                  </span>
                  <input
                    id="work-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("searchPlaceholder")}
                    className="min-w-0 flex-1 bg-transparent text-sm text-rose-950 placeholder:text-rose-400/85 outline-none transition-all duration-300 ease-out"
                    autoComplete="off"
                  />
                </div>
                <p className="mt-2 text-center text-xs text-rose-800/55">
                  {t("worksTotal", { count: works.length })}
                  {searchQuery.trim()
                    ? t("worksFiltered", { count: filteredWorks.length })
                    : null}
                  <span className="ml-1 text-rose-700/45">{t("worksHint")}</span>
                </p>
              </div>

              {filteredWorks.length === 0 ? (
                <div className="glass-panel mt-8 rounded-3xl px-8 py-14 text-center">
                  <p className="text-rose-900/85">{t("noMatch")}</p>
                  <p className="mt-2 text-sm text-rose-800/65">{t("noMatchHint")}</p>
                </div>
              ) : (
                <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredWorks.map((w) => (
                    <li key={w.id}>
                      <article className="glass-panel group flex flex-col overflow-hidden rounded-3xl shadow-md transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl">
                        <button
                          type="button"
                          onClick={() => openDetail(w)}
                          className="relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden bg-rose-100/50 text-left outline-none ring-rose-300/40 transition-all duration-300 ease-out focus-visible:ring-2"
                        >
                          <div className="pointer-events-none absolute left-3 top-3 z-[1] rounded-lg bg-white/92 px-2.5 py-1 text-xs font-semibold tabular-nums tracking-wide text-rose-900 shadow-md backdrop-blur-sm">
                            No.{w.displayNo}
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={w.imageUrl}
                            alt={`${w.title} (${t("displayNoLabel")} ${w.displayNo})`}
                            className="h-full w-full object-cover transition-transform duration-500 ease-out will-change-transform group-hover:scale-105"
                          />
                          <div className="card-caption-overlay pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3 pt-12">
                            <p className="text-xs font-semibold drop-shadow-md">
                              <span className="card-badge-no text-emerald-950/95">
                                {t("displayNoLabel")} {w.displayNo}
                              </span>
                            </p>
                            <p className="truncate text-lg font-medium text-white drop-shadow-md">
                              {w.title}
                            </p>
                            <p className="mt-1 text-[11px] text-white/90 drop-shadow">
                              {t("viewDetailHint")}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center justify-between gap-3 px-4 py-4">
                          <span className="text-sm text-rose-800/80">
                            {t("votesLabel")}{" "}
                            <strong className="text-rose-950">{w.votes}</strong>
                          </span>
                          <VotePillButton
                            disabled={remaining <= 0}
                            onVote={() => voteFromCard(w.id)}
                          >
                            {t("voteCard")}
                          </VotePillButton>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
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
