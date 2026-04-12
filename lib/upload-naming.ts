/** 去掉扩展名的文件名，作为默认作品标题 */
export function fileNameStem(fileName: string): string {
  const trimmed = fileName.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return trimmed || "未命名";
  return trimmed.slice(0, dot) || "未命名";
}

/** 统一前缀 + 文件名（无扩展名）；前缀可为空，则仅用文件名 */
export function buildWorkTitleFromFile(file: File, titlePrefix: string): string {
  const stem = fileNameStem(file.name);
  const p = titlePrefix.trim();
  if (!p) return stem;
  return `${p}${stem}`;
}

/** 云端同步等场景：仅有文件名时使用 */
export function buildWorkTitleFromFilename(
  fileName: string,
  titlePrefix: string
): string {
  const stem = fileNameStem(fileName);
  const p = titlePrefix.trim();
  if (!p) return stem;
  return `${p}${stem}`;
}
