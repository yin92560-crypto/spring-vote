import type { Metadata } from "next";
import { RankPageView } from "@/components/rank-page-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "春日人气排行榜 - 捕捉春日计划",
  description:
    "捕捉春日计划实时人气榜：按票数从高到低展示全部参赛作品冠亚季军与排名。",
};

export default async function RankPage() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full flex-1 flex-col">
      <RankPageView />
    </main>
  );
}
