import type { Metadata } from "next";
import Link from "next/link";
import { RankLeaderboard } from "@/components/rank-leaderboard";
import { RankPageVoteSync } from "@/components/rank-page-vote-sync";
import { fetchWorksRankedByVotes } from "@/lib/rank-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "春日人气排行榜 - 捕捉春日计划",
  description:
    "捕捉春日计划实时人气榜：按票数从高到低展示全部参赛作品冠亚季军与排名。",
};

export default async function RankPage() {
  const rankResult = await fetchWorksRankedByVotes()
    .then((works) => ({ ok: true as const, works }))
    .catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : "加载失败",
    }));

  return (
    <main className="relative flex min-h-screen flex-1 flex-col">
      <RankPageVoteSync />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.24]"
        aria-hidden
        style={{
          backgroundImage: `radial-gradient(circle at 18% 28%, rgba(255, 192, 203, 0.28) 0%, transparent 46%),
            radial-gradient(circle at 82% 18%, rgba(167, 243, 208, 0.22) 0%, transparent 42%),
            radial-gradient(circle at 52% 88%, rgba(251, 207, 232, 0.2) 0%, transparent 52%)`,
        }}
      />

      <header className="site-nav-fixed">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-white/55 bg-white/45 px-4 py-2 text-sm font-medium text-rose-900 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:bg-white/70"
            >
              ← 返回首页
            </Link>
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300/95 to-pink-400/90 text-lg shadow-inner ring-1 ring-white/45"
              aria-hidden
            >
              🏆
            </span>
            <div>
              <p className="text-sm font-medium text-rose-900/80">捕捉春日计划</p>
              <p className="text-xs text-rose-800/60">
                投票或管理变更后会自动刷新；切换回此标签时也会更新
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="btn-sakura inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-md"
          >
            管理后台
          </Link>
        </div>
      </header>

      <div className="relative z-[1] mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-12 pt-[calc(var(--nav-safe)+1rem)] sm:px-6">
        <section className="text-center">
          <h1 className="font-display text-4xl font-normal leading-tight sm:text-5xl">
            <span className="text-gradient-spring-title">春日人气排行榜</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-base leading-relaxed text-rose-900/80 sm:text-lg">
            全部作品按实时得票数从高到低排序；前三名登上领奖台，其余作品以紧凑列表展示排名。
          </p>
        </section>

        {!rankResult.ok ? (
          <div className="glass-panel mt-12 rounded-3xl px-8 py-14 text-center">
            <p className="text-lg text-rose-900/90">榜单暂时无法加载</p>
            <p className="mt-2 text-sm text-rose-800/70">{rankResult.error}</p>
            <Link
              href="/"
              className="btn-sakura mt-8 inline-flex rounded-xl px-8 py-3 text-sm font-medium text-white shadow-md"
            >
              返回首页
            </Link>
          </div>
        ) : (
          <div className="mt-12">
            <RankLeaderboard works={rankResult.works} />
          </div>
        )}

        <footer className="mt-20 border-t border-emerald-200/35 bg-gradient-to-b from-transparent via-emerald-50/20 to-white/30 py-8 text-center text-sm backdrop-blur-[2px]">
          <p className="text-rose-800/75">
            <span className="font-medium text-emerald-900/85">扎根生长 · 春华秋实</span>
            <span className="mx-2 text-emerald-800/35" aria-hidden>
              |
            </span>
            © 2026 华勤技术 · 捕捉春日计划
          </p>
        </footer>
      </div>
    </main>
  );
}
