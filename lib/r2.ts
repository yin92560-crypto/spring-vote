/**
 * Cloudflare R2 公共访问与对象 Key 约定。
 * 对象路径：`works/<UUID 目录>/<文件名>.<ext>`，与控制台三级结构一致。
 */

const HARDCODED_PUBLIC_ORIGIN = "https://assets.huaqintp.top";

export function getR2PublicOrigin(): string {
  return HARDCODED_PUBLIC_ORIGIN;
}

/** `https://assets.huaqintp.top/<key>` */
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
