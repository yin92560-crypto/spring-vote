import type { Work } from "./types";

/** 按创建时间升序分配编号：最早提交为 001，依次递增 */
export function addDisplayNumbers(
  rows: Omit<Work, "displayNo">[]
): Work[] {
  const sorted = [...rows].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const noById = new Map(
    sorted.map((w, i) => [w.id, String(i + 1).padStart(3, "0")])
  );
  return rows.map((w) => ({
    ...w,
    displayNo: noById.get(w.id) ?? "000",
  }));
}

/** 支持作品名称关键词；纯数字时按展示编号精确匹配（如 1、01、001） */
export function filterWorksBySearch(works: Work[], raw: string): Work[] {
  const q = raw.trim();
  if (!q) return works;

  const compact = q.replace(/\s/g, "");
  if (/^\d+$/.test(compact)) {
    const num = parseInt(compact, 10);
    if (num > 0) {
      const exact = works.filter(
        (w) => parseInt(w.displayNo, 10) === num
      );
      if (exact.length > 0) return exact;
    }
  }

  const lower = q.toLowerCase();
  return works.filter((w) => {
    const title = (w.title ?? "").toLowerCase();
    const workTitle = (w.workTitle ?? "").toLowerCase();
    const author = (w.authorName ?? "").toLowerCase();
    return (
      title.includes(lower) ||
      workTitle.includes(lower) ||
      author.includes(lower)
    );
  });
}
