/**
 * Cloudflare R2 公共访问与对象 Key 约定。
 * 对象路径：`works/<UUID 目录>/<文件名>.<ext>`，与控制台三级结构一致。
 */

const DEFAULT_PUBLIC_ORIGIN = "https://assets.huaqintp.top";

/**
 * 公共访问根：仅 scheme + host。
 * 若 `R2_PUBLIC_BASE_URL` 误带路径，剥掉以免与 Key 拼出重复段。
 */
export function getR2PublicOrigin(): string {
  const raw =
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim();
  if (!raw) return DEFAULT_PUBLIC_ORIGIN;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.origin;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}

/** `https://pub…r2.dev/<key>` */
export function buildR2PublicUrlForObjectKey(key: string): string {
  const origin = getR2PublicOrigin().replace(/\/+$/, "");
  const k = key.replace(/^\/+/, "");
  return `${origin}/${k}`;
}

/**
 * 上传对象 Key：`works/<同一 UUID>/<时间戳>.<ext>`
 * 目录名与文件名中的时间戳区分层级；`image_url` 与 `image_path` 与此 Key 一致。
 */
export function createWorksNestedObjectKey(ext: string): string {
  const e = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
  const safe = /^(webp|jpeg|jpg|png|gif)$/.test(e) ? e : "webp";
  const dirId = crypto.randomUUID();
  return `works/${dirId}/${Date.now()}.${safe}`;
}
