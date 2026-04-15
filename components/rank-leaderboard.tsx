"use client";

import Link from "next/link";
import { WorkRemoteImage } from "@/components/work-remote-image";
import { useI18n } from "@/lib/i18n-context";
import type { Work } from "@/lib/types";

type Props = {
  works: Work[];
};

const podiumStyles = {
  1: {
    emoji: "👑",
    card:
      "relative overflow-hidden rounded-[1.35rem] shadow-2xl ring-1 ring-amber-200/60",
    badge:
      "bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-amber-950 shadow-md",
    crown: "text-3xl drop-shadow sm:text-4xl",
  },
  2: {
    emoji: "🥈",
    card:
      "rank-podium-silver rank-podium-silver-breathe relative overflow-hidden rounded-3xl shadow-xl ring-2 ring-slate-300/90",
    badge:
      "bg-gradient-to-r from-slate-300 via-slate-100 to-slate-400 text-slate-900 shadow-md",
    crown: "text-2xl drop-shadow sm:text-3xl",
  },
  3: {
    emoji: "🥉",
    card:
      "rank-podium-bronze rank-podium-bronze-breathe relative overflow-hidden rounded-3xl shadow-xl ring-2 ring-amber-500/35",
    badge:
      "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-stone-50 shadow-md",
    crown: "text-2xl drop-shadow sm:text-3xl",
  },
} as const;

function PodiumCard({
  work,
  place,
}: {
  work: Work;
  place: 1 | 2 | 3;
}) {
  const { t } = useI18n();
  const s = podiumStyles[place];
  const rankWord =
    place === 1 ? t("champion") : place === 2 ? t("runnerUp") : t("thirdPlace");
  const cardBody = (
    <div
      className={`${s.card} relative flex flex-1 flex-col backdrop-blur-md ${
        place === 1
          ? "rank-first-inner bg-gradient-to-br from-amber-50/90 via-amber-50/50 to-white/55"
          : "bg-white/40"
      }`}
    >
      {place === 1 && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-0 rounded-[1.35rem] rank-podium-shimmer opacity-80"
            aria-hidden
          />
          <span
            className="rank-crown-float rank-trophy-emerald pointer-events-none absolute -top-5 left-1/2 z-[25] text-3xl sm:-top-6 sm:text-4xl"
            aria-hidden
          >
            👑
          </span>
          <span
            className="rank-trophy-emerald pointer-events-none absolute right-3 top-2 z-[25] text-2xl drop-shadow-md sm:right-4 sm:text-3xl"
            aria-hidden
          >
            🥇
          </span>
        </>
      )}
      <div className="relative z-[1] aspect-[4/3] w-full overflow-hidden bg-stone-100/40">
          <div
            className={`rank-badge-emerald-sheen absolute left-3 top-3 z-[2] flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold tabular-nums ${s.badge}`}
          >
            <span className={`${s.crown} rank-trophy-emerald`} aria-hidden>
              {s.emoji}
            </span>
            <span>{rankWord}</span>
            <span className="opacity-90">{t("placeRank", { n: place })}</span>
          </div>
          <Link
            href={`/?id=${work.displayNo}`}
            className="relative block h-full w-full outline-none ring-stone-300/30 focus-visible:ring-2"
          >
            <WorkRemoteImage
              src={work.imageUrl}
              alt=""
              className="h-full w-full"
              imgClassName="object-cover transition-transform duration-500 ease-out hover:scale-105"
            />
          </Link>
        </div>
        <div className="relative z-[1] flex flex-1 flex-col gap-2 px-4 pb-5 pt-4">
          <p className="font-display text-lg font-semibold leading-snug text-stone-950 sm:text-xl">
            <Link
              href={`/?id=${work.displayNo}`}
              className="hover:text-stone-800 hover:underline"
            >
              {work.title}
            </Link>
          </p>
          <p className="text-sm text-stone-800/75">
            {t("displayNoLabel")}{" "}
            <span className="font-mono font-semibold">{work.displayNo}</span>
          </p>
          <p className="mt-auto text-2xl font-bold tabular-nums text-stone-950">
            {work.votes}{" "}
            <span className="text-base font-medium text-stone-800/70">
              {t("votesUnit")}
            </span>
          </p>
        </div>
    </div>
  );

  return (
    <article
      className={`flex flex-col ${place === 1 ? "md:scale-[1.04] md:z-[2]" : ""}`}
    >
      {place === 1 ? (
        <div className="rank-first-frame">{cardBody}</div>
      ) : (
        cardBody
      )}
    </article>
  );
}

function RestRow({ work, rank }: { work: Work; rank: number }) {
  const { t } = useI18n();
  return (
    <li>
      <Link
        href={`/?id=${work.displayNo}`}
        className="glass-panel group flex items-center gap-4 rounded-2xl px-4 py-3 shadow-sm transition hover:-translate-y-1 hover:bg-white/95 hover:backdrop-blur-xl hover:shadow-2xl sm:gap-5 sm:px-5 sm:py-4"
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-stone-200/90 to-teal-100/80 font-mono text-lg font-bold tabular-nums text-stone-950 shadow-inner ring-1 ring-white/60 sm:h-12 sm:w-12 sm:text-xl"
          aria-label={t("placeRank", { n: rank })}
        >
          {rank}
        </span>
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-stone-100/50 sm:h-[4.5rem] sm:w-28">
          <WorkRemoteImage
            src={work.imageUrl}
            alt=""
            className="h-full w-full"
            imgClassName="object-cover transition duration-300 group-hover:scale-105"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-stone-950 sm:text-lg">
            {work.title}
          </p>
          <p className="mt-0.5 text-xs text-stone-800/65 sm:text-sm">
            {t("displayNoLabel")} {work.displayNo}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-bold tabular-nums text-stone-950 sm:text-2xl">
            {work.votes}
          </p>
          <p className="text-[11px] text-stone-800/60">{t("votesUnit")}</p>
        </div>
      </Link>
    </li>
  );
}

export function RankLeaderboard({ works }: Props) {
  const { t } = useI18n();
  if (works.length === 0) {
    return (
      <div className="glass-panel rounded-3xl px-8 py-16 text-center">
        <p className="text-lg text-stone-900/85">{t("rankEmpty")}</p>
        <p className="mt-2 text-sm text-stone-800/65">{t("rankEmptyDesc")}</p>
        <Link
          href="/"
          className="btn-sakura mt-8 inline-flex rounded-xl px-8 py-3 text-sm font-medium text-white shadow-md"
        >
          {t("backHome")}
        </Link>
      </div>
    );
  }

  const top3 = works.slice(0, 3);
  const rest = works.slice(3);

  return (
    <div className="space-y-12">
      {top3.length > 0 && (
        <section aria-labelledby="rank-podium-heading">
          <h2
            id="rank-podium-heading"
            className="sr-only"
          >
            {t("topThree")}
          </h2>
          <div className="flex flex-col items-stretch gap-8 md:flex-row md:items-end md:justify-center md:gap-6 lg:gap-8">
            {top3.length >= 2 && (
              <div className="order-2 w-full md:order-1 md:max-w-[min(100%,340px)] md:flex-1">
                <PodiumCard work={top3[1]} place={2} />
              </div>
            )}
            <div className="order-1 w-full md:order-2 md:max-w-[min(100%,380px)] md:flex-[1.15]">
              <PodiumCard work={top3[0]} place={1} />
            </div>
            {top3.length >= 3 && (
              <div className="order-3 w-full md:max-w-[min(100%,340px)] md:flex-1">
                <PodiumCard work={top3[2]} place={3} />
              </div>
            )}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="rank-rest-heading">
          <h2
            id="rank-rest-heading"
            className="mb-6 font-display text-2xl font-medium text-stone-950 sm:text-3xl"
          >
            {t("otherRanks")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-1 sm:gap-4 lg:grid-cols-2">
            {rest.map((w, i) => (
              <RestRow key={w.id} work={w} rank={i + 4} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
