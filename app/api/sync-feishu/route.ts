import { NextResponse } from "next/server";
import { assertAdminAuthorized } from "@/lib/admin-api-auth";
import {
  collectImageAttachments,
  createFeishuClient,
  downloadFeishuAttachmentCell,
  firstTextFromRecord,
  listAllRecords,
  listAllTableFields,
  parseFeishuBitableUrl,
  resolveFieldNames,
} from "@/lib/feishu-bitable";
import { buildWorkTitleFromFilename, fileNameStem } from "@/lib/upload-naming";
import { insertWorkFromImageBuffer } from "@/lib/works-upload-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
/** 单次同步最多处理的图片张数，避免超时 */
const MAX_IMAGES = 120;
const DOWNLOAD_GAP_MS = 150;

type Body = {
  tableUrl?: string;
  appToken?: string;
  tableId?: string;
  titlePrefix?: string;
  authorName?: string;
  workTitle?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildTitleForAttachment(
  attName: string | undefined,
  rowText: string,
  titlePrefix: string
): string {
  const stemFromFile = fileNameStem(attName || "image.jpg");
  if (rowText) {
    const combined = `${rowText}-${stemFromFile}`;
    const p = titlePrefix.trim();
    if (!p) return combined;
    return `${p}${combined}`;
  }
  return buildWorkTitleFromFilename(attName || "image.jpg", titlePrefix);
}

export async function POST(request: Request) {
  const unauthorized = assertAdminAuthorized(request);
  if (unauthorized) return unauthorized;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const titlePrefix = String(body.titlePrefix ?? "");
  const authorName = String(body.authorName ?? "").trim();
  const manualWorkTitle = String(body.workTitle ?? "").trim();
  let appToken = String(body.appToken ?? "").trim();
  let tableId = String(body.tableId ?? "").trim();
  const tableUrl = String(body.tableUrl ?? "").trim();

  if (tableUrl) {
    const parsed = parseFeishuBitableUrl(tableUrl);
    if (!parsed.appToken) {
      return NextResponse.json(
        { error: "无法从链接中解析多维表格 ID（需包含 /base/xxx）" },
        { status: 400 }
      );
    }
    appToken = parsed.appToken;
    if (parsed.tableId) tableId = parsed.tableId;
  }

  if (!appToken || !tableId) {
    return NextResponse.json(
      {
        error:
          "请提供 appToken 与 tableId，或粘贴包含 table= 参数的多维表格完整链接",
      },
      { status: 400 }
    );
  }

  let client;
  try {
    client = createFeishuClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "飞书未配置";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;
  let totalImages = 0;

  try {
    const fieldsMeta = await listAllTableFields(client, appToken, tableId);
    const { attachmentNames, textNames } = resolveFieldNames(fieldsMeta);

    if (attachmentNames.length === 0) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        skipped: 0,
        totalImages: 0,
        errors: ["当前数据表中未找到「附件」类型字段"],
      });
    }

    const rows = await listAllRecords(client, appToken, tableId);
    const tasks: Array<{
      att: import("@/lib/feishu-bitable").AttachmentCell;
      title: string;
    }> = [];

    for (const row of rows) {
      const rowText = firstTextFromRecord(row, textNames);
      const attachments = collectImageAttachments(row, attachmentNames);
      for (const att of attachments) {
        const title = buildTitleForAttachment(att.name, rowText, titlePrefix);
        tasks.push({ att, title });
      }
    }

    totalImages = tasks.length;
    if (totalImages === 0) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        skipped: 0,
        totalImages: 0,
        errors: ["未在记录中找到图片附件"],
      });
    }

    const batch = tasks.slice(0, MAX_IMAGES);
    if (tasks.length > MAX_IMAGES) {
      errors.push(`仅处理前 ${MAX_IMAGES} 张，共识别 ${tasks.length} 张`);
    }

    for (let i = 0; i < batch.length; i++) {
      const { att, title } = batch[i];
      if (i > 0) await sleep(DOWNLOAD_GAP_MS);

      let buffer: Buffer;
      let contentType: string;
      try {
        const dl = await downloadFeishuAttachmentCell(client, att);
        buffer = dl.buffer;
        contentType = dl.contentType;
      } catch (err) {
        skipped += 1;
        const label = att.name ?? att.file_token ?? "附件";
        errors.push(
          `${label}: ${err instanceof Error ? err.message : "下载失败"}`
        );
        continue;
      }

      if (buffer.length > MAX_IMAGE_BYTES) {
        skipped += 1;
        errors.push(`${att.name ?? "图片"}: 文件过大`);
        continue;
      }

      if (!contentType.startsWith("image/")) {
        const guess = att.type?.startsWith("image/")
          ? att.type
          : "image/jpeg";
        contentType = guess;
      }

      const result = await insertWorkFromImageBuffer({
        buffer,
        contentType,
        title,
        workTitle: manualWorkTitle || title,
        authorName,
      });

      if (result.ok) {
        imported += 1;
      } else {
        skipped += 1;
        errors.push(`${title}: ${result.error}`);
      }
    }
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "同步失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    totalImages,
    errors,
  });
}
