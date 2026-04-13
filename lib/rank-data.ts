import { addDisplayNumbers } from "@/lib/work-display";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Work } from "@/lib/types";

/**
 * 读取全部作品与实时票数（与 /api/works 一致），按票数降序排列；
 * 票数相同时按提交时间升序（编号更小者优先）。
 */
export async function fetchWorksRankedByVotes(): Promise<Work[]> {
  const supabase = createAdminClient();

  const { data: works, error: wErr } = await supabase
    .from("works")
    .select("id, title, work_title, author_name, image_url, created_at")
    .order("created_at", { ascending: false });

  if (wErr) {
    console.error(wErr);
    throw new Error("读取作品失败");
  }

  const { data: voteRows, error: vErr } = await supabase
    .from("votes")
    .select("work_id");

  if (vErr) {
    console.error(vErr);
    throw new Error("读取票数失败");
  }

  const counts = new Map<string, number>();
  for (const row of voteRows ?? []) {
    const wid = row.work_id as string;
    counts.set(wid, (counts.get(wid) ?? 0) + 1);
  }

  const list = addDisplayNumbers(
    (works ?? []).map((w) => ({
      id: w.id as string,
      title: w.title as string,
      workTitle: (w.work_title as string | null) ?? (w.title as string),
      authorName: (w.author_name as string | null) ?? "",
      imageUrl: w.image_url as string,
      votes: counts.get(w.id as string) ?? 0,
      createdAt: w.created_at as string,
    }))
  );

  return list.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
