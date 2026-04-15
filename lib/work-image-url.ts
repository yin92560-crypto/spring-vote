import { getR2PublicOrigin } from "@/lib/r2";

/** @deprecated 使用 {@link getR2PublicOrigin}；保留别名供旧代码引用 */
export function getR2PublicBaseUrl(): string {
  return getR2PublicOrigin();
}

function collapseDuplicateWorksPath(pathname: string): string {
  let p = pathname.replace(/\/+/g, "/");
  while (p.includes("/works/works/")) {
    p = p.replace(/\/works\/works\//g, "/works/");
  }
  return p;
}

function stripLeadingWorksDupes(relativePath: string): string {
  let p = relativePath.replace(/^\/+/, "");
  while (p.startsWith("works/works/")) {
    p = p.slice("works/".length);
  }
  return p;
}

function ensureHttpsUrl(u: URL): void {
  if (u.protocol === "http:") {
    u.protocol = "https:";
  }
}

/**
 * 将数据库中的 `image_url` 规范为可请求的绝对 https 地址。
 * - 已是 `http(s)://` 的经 `URL` 校验后返回 `href`
 * - 以 `//` 开头的补全为 https
 * - 其余视为对象路径（如 `works/uuid/123.webp` 或 `/works/...`），拼到公共域名下
 */
export function normalizeWorkImageUrl(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";

  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      u.hash = "";
      u.pathname = collapseDuplicateWorksPath(u.pathname);
      ensureHttpsUrl(u);
      return u.href;
    } catch {
      return "";
    }
  }

  if (t.startsWith("//")) {
    try {
      const u = new URL(`https:${t}`);
      u.pathname = collapseDuplicateWorksPath(u.pathname);
      ensureHttpsUrl(u);
      return u.href;
    } catch {
      return "";
    }
  }

  const base = `${getR2PublicOrigin().replace(/\/+$/, "")}/`;
  const path = stripLeadingWorksDupes(t);
  try {
    const u = new URL(path, base);
    ensureHttpsUrl(u);
    return u.href;
  } catch {
    return "";
  }
}

/**
 * 当前上传：`works/<uuid>/<timestamp>.<ext>`；
 * 兼容扁平历史：`works/<uuid>.<ext>`。
 */
export function isSafeR2ObjectKey(key: string): boolean {
  const k = key.trim();
  if (/^works\/[0-9a-f-]{36}\/\d+\.[a-zA-Z0-9]+$/i.test(k)) return true;
  if (/^works\/[0-9a-f-]{36}\.[a-zA-Z0-9]+$/i.test(k)) return true;
  return /^[a-zA-Z0-9_-]+\/[0-9a-f-]{36}\/\d+\.[a-zA-Z0-9]+$/i.test(k);
}

/** 写入 `image_path` 时：优先 R2 规范 Key，其余仅允许安全字符（兼容历史数据） */
export function isAcceptableWorksImagePath(key: string): boolean {
  const k = key.trim();
  if (isSafeR2ObjectKey(k)) return true;
  if (k.length > 512 || k.includes("..")) return false;
  return /^[a-zA-Z0-9/_.-]+$/.test(k);
}
