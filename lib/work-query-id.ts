import type { Work } from "./types";

/** 根据 URL 查询参数 id（如 001、1）匹配作品 */
export function findWorkByDisplayQuery(
  works: Work[],
  raw: string | null
): Work | null {
  if (!raw) return null;
  const compact = raw.trim();
  if (!/^\d+$/.test(compact)) return null;
  const num = parseInt(compact, 10);
  if (num <= 0) return null;
  return works.find((w) => parseInt(w.displayNo, 10) === num) ?? null;
}
