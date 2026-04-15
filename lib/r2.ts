/**
 * Cloudflare R2 公共访问与对象 Key 约定（与控制台路径一致）。
 * 扁平结构：`https://<pub>/works/<uuid>.webp`，避免多层目录拼接错误。
 */

const DEFAULT_PUBLIC_ORIGIN = "https://pub-c32b84ede21d4770b966e9e4718d0a0d.r2.dev";

/**
 * 公共访问根：仅 scheme + host。
 * 若 `R2_PUBLIC_BASE_URL` 误写成带 `/works` 等路径，这里会剥掉，防止与对象 Key 再拼出 `…/works/works/…`。
 */
export function getR2PublicOrigin(): string {
  const raw = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!raw) return DEFAULT_PUBLIC_ORIGIN;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.origin;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}

/** `https://pub…r2.dev/<key>`，key 不含前导斜杠 */
export function buildR2PublicUrlForObjectKey(key: string): string {
  const origin = getR2PublicOrigin().replace(/\/+$/, "");
  const k = key.replace(/^\/+/, "");
  return `${origin}/${k}`;
}

/**
 * 新上传对象 Key：`works/<与文件名相同的 UUID>.webp`
 * 存库 `image_path` 与此字符串完全一致；`image_url` 由 {@link buildR2PublicUrlForObjectKey} 生成，UUID 与 R2 对象一致。
 */
export function createWorksFlatObjectKey(ext: string): string {
  const e = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
  const safe = /^(webp|jpeg|jpg|png|gif)$/.test(e) ? e : "webp";
  const id = crypto.randomUUID();
  return `works/${id}.${safe}`;
}
