"use client";

import Link from "next/link";
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
        <p className="text-sm font-medium text-stone-900/80 drop-shadow-sm">
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

function HomeSiteNav() {
  const { t } = useI18n();
  return (
    <header className="site-nav-fixed">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-0">
        <p className="min-w-0 pr-1 font-display text-[0.95rem] font-medium text-stone-950 sm:text-lg">
          <span className="text-gradient-spring-title">{t("title")}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Link
            href="/rank"
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-white/55 bg-white/40 px-2.5 py-2 text-xs font-medium shadow-sm backdrop-blur-md transition-colors hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300/50 sm:gap-1.5 sm:px-3 sm:text-sm"
          >
            <Trophy
              className="size-4 shrink-0 text-stone-950/90"
              strokeWidth={2}
              aria-hidden
            />
            <span className="text-gradient-spring-title">{t("rank")}</span>
          </Link>
          <Link
            href="/admin"
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-white/55 bg-white/40 px-2.5 py-2 text-xs font-medium shadow-sm backdrop-blur-md transition-colors hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300/50 sm:gap-1.5 sm:px-3 sm:text-sm"
          >
            <Settings
              className="size-4 shrink-0 text-stone-950/90"
              strokeWidth={2}
              aria-hidden
            />
            <span className="text-gradient-spring-title">{t("admin")}</span>
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
      <HomeSiteNav />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-[calc(var(--nav-safe)+1.15rem)] sm:px-6 sm:pt-[calc(var(--nav-safe)+1.25rem)]">
        <section className="text-center">
          <h1 className="font-display text-[1.95rem] font-normal leading-[1.2] tracking-[0.01em] sm:text-5xl sm:leading-[1.18]">
            <span className="text-gradient-spring-title">{t("subtitle")}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-stone-900/75">
            {t("heroDesc")}
          </p>
          <p className="mt-6 text-sm font-medium text-stone-900/85">
            {t("remainingVotes")}{" "}
            <span className="tabular-nums text-lg text-stone-950">{remaining}</span>
            <span className="text-stone-800/55"> / 3</span>
          </p>
        </section>

        {toast && (
          <div
            role="status"
            className="glass-panel fixed bottom-8 left-1/2 z-[110] -translate-x-1/2 rounded-full px-6 py-2.5 text-sm text-stone-900 shadow-lg transition-all duration-300 ease-out"
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

        <section className="mt-16">
          {works.length === 0 ? (
            <div className="glass-panel rounded-3xl px-8 py-16 text-center">
              <p className="text-lg text-stone-900/80">{t("noWorks")}</p>
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
                <label htmlFor="work-search" className="sr-only">
                  {t("searchAria")}
                </label>
                <div className="search-glow glass-panel flex items-center gap-3 rounded-2xl border border-emerald-100/45 bg-gradient-to-r from-white/55 via-emerald-50/25 to-stone-50/40 px-4 py-3 backdrop-blur-md">
                  <span
                    className="shrink-0 text-lg text-stone-400/90"
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
                    className="min-w-0 flex-1 bg-transparent text-sm text-stone-950 placeholder:text-stone-400/85 outline-none transition-all duration-300 ease-out"
                    autoComplete="off"
                  />
                </div>
                <p className="mt-2 text-center text-xs text-stone-800/55">
                  {t("worksTotal", { count: works.length })}
                  {searchQuery.trim()
                    ? t("worksFiltered", { count: filteredWorks.length })
                    : null}
                </p>
              </div>

              {filteredWorks.length === 0 ? (
                <div className="glass-panel mt-8 rounded-3xl px-8 py-14 text-center">
                  <p className="text-stone-900/85">{t("noMatch")}</p>
                  <p className="mt-2 text-sm text-stone-800/65">{t("noMatchHint")}</p>
                </div>
              ) : (
                <ul className="mt-7 grid gap-5 sm:mt-8 sm:gap-7 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredWorks.map((w) => (
                    <li key={w.id}>
                      <article className="glass-panel group flex flex-col overflow-hidden rounded-[1.6rem] shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md">
                        <button
                          type="button"
                          onClick={() => openDetail(w)}
                          className="relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden bg-stone-100/50 text-left outline-none ring-stone-300/40 transition-all duration-300 ease-out focus-visible:ring-2"
                        >
                          <div className="pointer-events-none absolute left-3 top-3 z-[1] rounded-lg bg-white/92 px-2.5 py-1 text-xs font-semibold tabular-nums tracking-wide text-stone-900 shadow-md backdrop-blur-sm">
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
                              <span className="card-badge-no text-emerald-800/90">
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
                          <span className="text-sm text-stone-800/80">
                            {t("votesLabel")}{" "}
                            <strong className="text-stone-950">{w.votes}</strong>
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
