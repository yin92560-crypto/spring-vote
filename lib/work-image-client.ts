/** 浏览器端作品图 URL 处理（无服务端 env 依赖） */

export function forceHttpsUrl(url: string): string {
  const t = url.trim();
  if (t.startsWith("http://")) return `https://${t.slice("http://".length)}`;
  return t;
}

/** 同地址重试时追加查询参数，避免缓存导致 onError 后无法重新请求 */
export function withImageLoadRetryQuery(url: string, attempt: number): string {
  const u = forceHttpsUrl(url);
  if (attempt <= 0) return u;
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}_rv=${attempt}`;
}
