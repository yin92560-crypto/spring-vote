"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { WorkRemoteImage } from "@/components/work-remote-image";
import { withImageLoadRetryQuery } from "@/lib/work-image-client";
import { VotePillButton } from "@/components/vote-pill-button";
import { useI18n } from "@/lib/i18n-context";
import type { Work } from "@/lib/types";

type Props = {
  work: Work | null;
  /** 当前列表可翻页范围（与首页筛选结果一致，通常为 filteredWorks） */
  navigableWorks: Work[];
  onNavigateTo: (w: Work) => void;
  /** 当前作品专属分享链接（含 origin 与 ?id= 编号） */
  shareUrl: string;
  onClose: () => void;
  remaining: number;
  voting: boolean;
  onVote: () => void;
  onShareCopied?: () => void;
  onShareCopyFailed?: () => void;
};

/** 与数据库中 image_url 一致，指向 Storage 桶内原始对象，不做尺寸压缩 */
function originalImageUrl(work: Work): string {
  return work.imageUrl;
}

export function WorkDetailModal({
  work,
  navigableWorks,
  onNavigateTo,
  shareUrl,
  onClose,
  remaining,
  voting,
  onVote,
  onShareCopied,
  onShareCopyFailed,
}: Props) {
  const { t } = useI18n();
  const [fullPreview, setFullPreview] = useState(false);
  const [fullPreviewShown, setFullPreviewShown] = useState(false);
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const [hdLoadErrors, setHdLoadErrors] = useState(0);
  const closeFullTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { index, canNavigate } = useMemo(() => {
    if (!work || navigableWorks.length === 0) {
      return { index: -1, canNavigate: false };
    }
    const i = navigableWorks.findIndex((w) => w.id === work.id);
    const ok = i >= 0 && navigableWorks.length > 1;
    return { index: i, canNavigate: ok };
  }, [work, navigableWorks]);

  const goPrev = useCallback(() => {
    if (!work || !canNavigate || index < 0) return;
    const len = navigableWorks.length;
    const prevIndex = (index - 1 + len) % len;
    onNavigateTo(navigableWorks[prevIndex]);
  }, [work, canNavigate, index, navigableWorks, onNavigateTo]);

  const goNext = useCallback(() => {
    if (!work || !canNavigate || index < 0) return;
    const len = navigableWorks.length;
    const nextIndex = (index + 1) % len;
    onNavigateTo(navigableWorks[nextIndex]);
  }, [work, canNavigate, index, navigableWorks, onNavigateTo]);

  const closeFullPreview = useCallback(() => {
    setFullPreviewShown(false);
    if (closeFullTimerRef.current) clearTimeout(closeFullTimerRef.current);
    closeFullTimerRef.current = setTimeout(() => {
      setFullPreview(false);
      setFullImageLoaded(false);
      setHdLoadErrors(0);
      closeFullTimerRef.current = null;
    }, 320);
  }, []);

  const openFullPreview = useCallback(() => {
    if (closeFullTimerRef.current) {
      clearTimeout(closeFullTimerRef.current);
      closeFullTimerRef.current = null;
    }
    setFullImageLoaded(false);
    setFullPreview(true);
  }, []);

  useEffect(() => {
    if (closeFullTimerRef.current) {
      clearTimeout(closeFullTimerRef.current);
      closeFullTimerRef.current = null;
    }
    const t = window.setTimeout(() => {
      setFullPreview(false);
      setFullPreviewShown(false);
      setFullImageLoaded(false);
      setHdLoadErrors(0);
    }, 0);
    return () => window.clearTimeout(t);
  }, [work?.id]);

  useEffect(() => {
    setHdLoadErrors(0);
    setFullImageLoaded(false);
  }, [work?.imageUrl]);

  useEffect(() => {
    if (hdLoadErrors >= 2) setFullImageLoaded(true);
  }, [hdLoadErrors]);

  useEffect(() => {
    if (!fullPreview) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setFullPreviewShown(true));
    });
    return () => cancelAnimationFrame(id);
  }, [fullPreview]);

  useEffect(() => {
    if (!work) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [work]);

  useEffect(() => {
    if (!work) return;
    const onKey = (e: KeyboardEvent) => {
      if (fullPreview) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeFullPreview();
        }
        return;
      }
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (!canNavigate) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    work,
    fullPreview,
    onClose,
    closeFullPreview,
    canNavigate,
    goPrev,
    goNext,
  ]);

  const handleShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      onShareCopied?.();
    } catch {
      onShareCopyFailed?.();
    }
  };

  if (!work) return null;

  const hdUrl = originalImageUrl(work);
  const hdDisplaySrc = withImageLoadRetryQuery(
    hdUrl,
    hdLoadErrors >= 1 && hdLoadErrors < 2 ? 1 : 0,
  );

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <button
          type="button"
          aria-label={t("detailCloseBackdrop")}
          className="work-detail-backdrop absolute inset-0 bg-stone-950/35 backdrop-blur-xl"
          onClick={onClose}
        />

        <div
          className="work-detail-panel glass-panel relative z-[1] flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="work-detail-title"
        >
          <div className="relative max-h-[min(58vh,560px)] w-full shrink-0 overflow-hidden bg-stone-100/40 sm:max-h-[min(62vh,620px)]">
            {canNavigate && (
              <>
                <button
                  type="button"
                  aria-label={t("detailPrevAria")}
                  className="work-detail-nav-btn absolute left-2 top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-lg font-bold text-stone-900/90 sm:left-3 sm:h-12 sm:w-12 sm:text-xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label={t("detailNextAria")}
                  className="work-detail-nav-btn absolute right-2 top-1/2 z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-lg font-bold text-stone-900/90 sm:right-3 sm:h-12 sm:w-12 sm:text-xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                >
                  ›
                </button>
              </>
            )}
            <button
              type="button"
              className="group relative z-[1] mx-auto block h-full w-full cursor-zoom-in overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
              aria-label={t("detailViewHdAria")}
              onClick={(e) => {
                e.stopPropagation();
                openFullPreview();
              }}
            >
              <WorkRemoteImage
                key={work.id}
                src={work.imageUrl}
                alt=""
                layout="intrinsic"
                loading="eager"
                className="mx-auto min-h-[min(36vh,280px)] w-full max-w-full max-h-[min(58vh,560px)] sm:min-h-[min(40vh,320px)] sm:max-h-[min(62vh,620px)]"
                imgClassName="work-detail-img-fade max-h-[min(58vh,560px)] w-full object-contain object-center transition-transform duration-500 ease-out will-change-transform group-hover:scale-105 sm:max-h-[min(62vh,620px)]"
              />
              <span
                className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-xs text-white/95 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100"
                aria-hidden
              >
                {t("detailViewHdHint")}
              </span>
            </button>
          </div>

          <div className="border-t border-emerald-200/35 bg-gradient-to-b from-white/45 to-emerald-50/20 px-5 py-5 sm:px-8 sm:py-6">
            <div className="mb-4 flex flex-wrap items-start gap-3">
              <span className="card-badge-no font-mono text-sm font-bold tabular-nums text-emerald-950 shadow-sm">
                {t("displayNoLabel")} {work.displayNo}
              </span>
              <h2
                id="work-detail-title"
                className="min-w-0 flex-1 font-display text-xl font-medium leading-snug text-stone-950 sm:text-2xl"
              >
                {work.workTitle || work.title}
              </h2>
            </div>
            <p className="mb-6 text-base text-stone-900/85">
              {t("detailVotesLine")}
              <strong className="tabular-nums text-stone-950">{work.votes}</strong>{" "}
              {t("votesUnit")}
              <span className="ml-2 text-sm text-stone-800/65">
                {t("detailRemainingToday", { n: remaining })}
              </span>
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => void handleShare()}
                className="order-1 rounded-xl border border-amber-300/70 bg-gradient-to-r from-white/60 via-stone-50/50 to-teal-50/45 px-6 py-3 text-sm font-semibold text-stone-900 shadow-sm backdrop-blur-sm transition hover:from-white/80 hover:border-amber-400/80 sm:order-1"
              >
                {t("share")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="order-3 rounded-xl border border-stone-200/90 bg-white/50 px-6 py-3 text-sm font-medium text-stone-900 backdrop-blur-sm transition hover:bg-white/80 sm:order-2 sm:w-auto"
              >
                {t("close")}
              </button>
              <VotePillButton
                disabled={remaining <= 0 || voting}
                onVote={onVote}
                className="vote-pill-btn-lg order-2 w-full sm:order-3 sm:min-w-[200px]"
              >
                {voting ? t("voteSubmitting") : t("voteForTa")}
              </VotePillButton>
            </div>
          </div>
        </div>
      </div>

      {fullPreview && (
        <div
          className="fixed inset-0 z-[125] flex flex-col bg-black/88 opacity-100 backdrop-blur-md transition-[opacity] duration-300 ease-out"
          role="dialog"
          aria-modal="true"
          aria-label={t("detailViewHdAria")}
          onClick={closeFullPreview}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeFullPreview();
            }}
            className="absolute right-3 top-3 z-20 rounded-xl border border-white/25 bg-white/12 px-4 py-2 text-sm font-medium text-white/95 shadow-lg backdrop-blur-md transition hover:bg-white/22 hover:shadow-[0_0_24px_rgba(244,143,177,0.35)] sm:right-5 sm:top-5"
          >
            {t("closePreview")}
          </button>

          <p
            className="pointer-events-none absolute left-3 top-3 z-20 max-w-[min(100%,20rem)] rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/85 backdrop-blur-md sm:left-5 sm:top-5"
            aria-hidden
          >
            {t("hdOriginal")}
          </p>

          <div
            className="flex min-h-0 flex-1 cursor-zoom-out items-center justify-center px-3 pb-6 pt-14 sm:px-8 sm:pb-10 sm:pt-20"
            onClick={closeFullPreview}
          >
            <div
              className={`relative flex max-h-[min(88dvh,920px)] w-full max-w-[min(100%,1400px)] cursor-zoom-out items-center justify-center opacity-100 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                fullPreviewShown
                  ? "translate-y-0 scale-100"
                  : "translate-y-4 scale-[0.93]"
              }`}
            >
              {!fullImageLoaded && (
                <div
                  className="absolute inset-0 z-10 flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl bg-black/25"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="spring-loading-mark" role="status" aria-hidden>
                    <span className="spring-loading-leaf">🍃</span>
                    <span className="spring-loading-sprout" />
                  </div>
                  <span className="text-sm text-amber-100/90">{t("loadingHd")}</span>
                </div>
              )}
              <Image
                key={`full-${work.id}-${hdDisplaySrc}-${hdLoadErrors}`}
                src={hdDisplaySrc}
                alt=""
                width={2400}
                height={1800}
                unoptimized
                sizes="100vw"
                className="max-h-[min(88dvh,920px)] w-auto max-w-full cursor-zoom-out rounded-lg object-contain opacity-100 shadow-2xl ring-1 ring-white/10"
                onLoad={() => {
                  setFullImageLoaded(true);
                  setHdLoadErrors(0);
                }}
                onError={() => setHdLoadErrors((n) => n + 1)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
