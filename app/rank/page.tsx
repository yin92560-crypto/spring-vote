import type { Metadata } from "next";
import { RankPageView } from "@/components/rank-page-view";
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

  return <RankPageView rankResult={rankResult} />;
}
