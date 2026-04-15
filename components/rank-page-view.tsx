"use client";

import Link from "next/link";
import Image from "next/image";
import { RankLeaderboard } from "@/components/rank-leaderboard";
import { RankPageVoteSync } from "@/components/rank-page-vote-sync";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n-context";
import type { Work } from "@/lib/types";

type RankResult =
  | { ok: true; works: Work[] }
  | { ok: false; error: string };

export function RankPageView({ rankResult }: { rankResult: RankResult }) {
  const { t } = useI18n();

  return (
    <main className="relative flex min-h-screen flex-1 flex-col">
      <RankPageVoteSync />

      <header className="site-nav-fixed">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-3.5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Image
              src="/huaqin-logo-new.png"
              alt="华勤 Logo"
              width={88}
              height={28}
              className="h-7 w-auto shrink-0 rounded-md"
              priority
              unoptimized
            />
            <Link
              href="/"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-emerald-200/70 bg-amber-50/75 px-3 py-2 text-xs font-medium text-stone-800 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:bg-amber-50/95 sm:px-4 sm:text-sm"
            >
              ← {t("backHome")}
            </Link>
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200/90 to-emerald-300/85 text-lg shadow-inner ring-1 ring-white/45"
              aria-hidden
            >
              🏆
            </span>
            <div>
              <p className="text-sm font-medium text-stone-700/85">{t("title")}</p>
              <p className="text-xs text-stone-800/60">{t("rankSyncHint")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <LanguageSwitcher />
            <Link
              href="/admin"
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-emerald-200/70 bg-amber-50/72 px-4 py-2 text-xs font-medium text-stone-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-amber-50/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/55 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              {t("admin")}
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-[1] mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-14 pt-[calc(var(--nav-safe)+1.25rem)] sm:px-6">
        <section className="text-center">
          <h1 className="font-display text-4xl font-normal leading-[1.18] tracking-[0.01em] sm:text-5xl">
            <span className="text-gradient-spring-title">{t("rankPageTitle")}</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-base leading-relaxed text-stone-700/85 sm:text-lg">
            {t("rankPageDesc")}
          </p>
        </section>

        {!rankResult.ok ? (
          <div className="glass-panel mt-12 rounded-3xl px-8 py-14 text-center">
            <p className="text-lg text-stone-800/90">{t("rankLoadError")}</p>
            <p className="mt-2 text-sm text-stone-800/70">{rankResult.error}</p>
            <Link
              href="/"
              className="btn-sakura mt-8 inline-flex rounded-xl px-8 py-3 text-sm font-medium text-white shadow-md"
            >
              {t("backHome")}
            </Link>
          </div>
        ) : (
          <div className="mt-12">
            <RankLeaderboard works={rankResult.works} />
          </div>
        )}

        <footer className="mt-20 border-t border-emerald-200/35 bg-gradient-to-b from-transparent via-emerald-50/20 to-white/30 py-8 text-center text-sm backdrop-blur-[2px]">
          <div className="mx-auto flex max-w-6xl flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2 bg-transparent sm:gap-x-4">
            <p className="bg-transparent px-1 text-stone-800/75">
              <span className="font-medium text-emerald-900/85">{t("footerTagline")}</span>
              <span className="mx-2 text-emerald-800/35" aria-hidden>
                |
              </span>
              {t("footerCopyright")}
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
