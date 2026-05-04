import { readFileSync } from "fs";
import { join } from "path";
import {
  parseStaticWorksJsonArray,
  RANK_LEADERBOARD_LIMIT,
  sortWorksRankedByVotes,
} from "@/lib/static-works-from-json";
import type { Work } from "@/lib/types";

/**
 * 服务端读取 public/data.json，不再查询 Supabase。
 */
export function loadRankedWorksFromPublicFile(): Work[] {
  const filePath = join(process.cwd(), "public", "data.json");
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  const works = parseStaticWorksJsonArray(raw);
  return sortWorksRankedByVotes(works).slice(0, RANK_LEADERBOARD_LIMIT);
}

export async function fetchWorksRankedByVotes(): Promise<Work[]> {
  return loadRankedWorksFromPublicFile();
}
