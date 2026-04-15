/**
 * R2 公共访问根（与 `app/api/upload/route.ts` 一致，用于补全非绝对地址）。
 * 仅应在服务端读取；浏览器端拿到的应是 `/api/works` 已规范化的绝对 URL。
 */
export function getR2PublicBaseUrl(): string {
  const fromEnv = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  return "https://pub-c32b84ede21d4770b966e9e4718d0a0d.r2.dev";
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
      return u.href;
    } catch {
      return "";
    }
  }

  if (t.startsWith("//")) {
    try {
      return new URL(`https:${t}`).href;
    } catch {
      return "";
    }
  }

  const base = `${getR2PublicBaseUrl().replace(/\/+$/, "")}/`;
  const path = t.replace(/^\/+/, "");
  try {
    return new URL(path, base).href;
  } catch {
    return "";
  }
}

/** 与上传接口生成的 Key 一致：`{folder}/{uuid}/{timestamp}.{ext}` */
export function isSafeR2ObjectKey(key: string): boolean {
  return /^[a-zA-Z0-9_-]+\/[0-9a-f-]{36}\/\d+\.[a-zA-Z0-9]+$/.test(key.trim());
}

/** 写入 `image_path` 时：优先 R2 规范 Key，其余仅允许安全字符（兼容历史数据） */
export function isAcceptableWorksImagePath(key: string): boolean {
  const k = key.trim();
  if (isSafeR2ObjectKey(k)) return true;
  if (k.length > 512 || k.includes("..")) return false;
  return /^[a-zA-Z0-9/_.-]+$/.test(k);
}
