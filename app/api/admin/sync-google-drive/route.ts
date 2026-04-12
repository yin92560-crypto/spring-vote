import { NextResponse } from "next/server";
import { assertAdminAuthorized } from "@/lib/admin-api-auth";
import {
  downloadDriveFileBuffer,
  listImageFilesInFolder,
  parseGoogleDriveFolderId,
} from "@/lib/google-drive";
import { buildWorkTitleFromFilename } from "@/lib/upload-naming";
import { insertWorkFromImageBuffer } from "@/lib/works-upload-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_FILES = 80;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

type Body = {
  folderUrl?: string;
  titlePrefix?: string;
};

export async function POST(request: Request) {
  const unauthorized = assertAdminAuthorized(request);
  if (unauthorized) return unauthorized;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const folderUrl = String(body.folderUrl ?? "").trim();
  const titlePrefix = String(body.titlePrefix ?? "");

  const folderId = parseGoogleDriveFolderId(folderUrl);
  if (!folderId) {
    return NextResponse.json(
      { error: "无法解析文件夹链接或 ID，请粘贴完整 Drive 文件夹链接" },
      { status: 400 }
    );
  }

  let images: Awaited<ReturnType<typeof listImageFilesInFolder>>;
  try {
    images = await listImageFilesInFolder(folderId);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Drive 访问失败";
    return NextResponse.json(
      {
        error: msg.includes("缺少 Google")
          ? msg
          : `无法读取 Google Drive（请检查服务账号凭证，并将文件夹共享给服务账号邮箱）：${msg}`,
      },
      { status: 500 }
    );
  }

  if (images.length === 0) {
    return NextResponse.json({
      ok: true,
      imported: 0,
      skipped: 0,
      totalListed: 0,
      errors: ["文件夹内没有可识别的图片文件"],
    });
  }

  const batch = images.slice(0, MAX_FILES);
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (const file of batch) {
    const sizeNum = file.size ? parseInt(file.size, 10) : 0;
    if (sizeNum > MAX_IMAGE_BYTES) {
      skipped += 1;
      errors.push(`${file.name}: 文件过大（>${MAX_IMAGE_BYTES} 字节）`);
      continue;
    }

    let buffer: Buffer;
    try {
      buffer = await downloadDriveFileBuffer(file.id);
    } catch (err) {
      console.error(err);
      skipped += 1;
      errors.push(`${file.name}: 下载失败`);
      continue;
    }

    if (buffer.length > MAX_IMAGE_BYTES) {
      skipped += 1;
      errors.push(`${file.name}: 下载后体积过大`);
      continue;
    }

    const title = buildWorkTitleFromFilename(file.name, titlePrefix);
    const result = await insertWorkFromImageBuffer({
      buffer,
      contentType: file.mimeType,
      title,
    });

    if (result.ok) {
      imported += 1;
    } else {
      skipped += 1;
      errors.push(`${file.name}: ${result.error}`);
    }
  }

  if (images.length > MAX_FILES) {
    errors.push(
      `本次最多处理 ${MAX_FILES} 张，共列出 ${images.length} 张，未处理的请分批同步或移入子文件夹`
    );
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    totalListed: images.length,
    processed: batch.length,
    errors,
  });
}
