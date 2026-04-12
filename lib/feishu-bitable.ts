import { AppType, Client, Domain } from "@larksuiteoapi/node-sdk";
import { buffer as streamBuffer } from "node:stream/consumers";

export type AttachmentCell = {
  file_token?: string;
  name?: string;
  type?: string;
  tmp_url?: string;
};

/** 从浏览器复制的多维表格链接中解析 app_token、table_id */
export function parseFeishuBitableUrl(input: string): {
  appToken: string | null;
  tableId: string | null;
} {
  const raw = input.trim();
  if (!raw) return { appToken: null, tableId: null };

  try {
    const url = raw.startsWith("http") ? new URL(raw) : new URL(`https://${raw}`);
    const baseMatch = url.pathname.match(/\/base\/([A-Za-z0-9]+)/);
    const appToken = baseMatch?.[1] ?? null;
    const tableId = url.searchParams.get("table");
    return { appToken, tableId };
  } catch {
    return { appToken: null, tableId: null };
  }
}

export function createFeishuClient(): Client {
  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error("缺少环境变量 FEISHU_APP_ID / FEISHU_APP_SECRET");
  }
  return new Client({
    appId,
    appSecret,
    appType: AppType.SelfBuild,
    domain: Domain.Feishu,
  });
}

/** 使用素材/云文件接口下载附件二进制（数据库仅保存 Supabase 永久 URL） */
export async function downloadFeishuAttachment(
  client: Client,
  fileToken: string
): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const dl = await client.drive.media.download({
      path: { file_token: fileToken },
    });
    const buf = await streamBuffer(dl.getReadableStream());
    const raw =
      dl.headers?.["content-type"] ??
      dl.headers?.["Content-Type"] ??
      "application/octet-stream";
    const contentType = String(raw).split(";")[0].trim();
    return { buffer: buf, contentType };
  } catch {
    const dl2 = await client.drive.file.download({
      path: { file_token: fileToken },
    });
    const buf = await streamBuffer(dl2.getReadableStream());
    const raw =
      dl2.headers?.["content-type"] ??
      dl2.headers?.["Content-Type"] ??
      "application/octet-stream";
    const contentType = String(raw).split(";")[0].trim();
    return { buffer: buf, contentType };
  }
}

/** file_token 优先；仅当缺失时用临时链接拉取字节（仍写入 Supabase，不存飞书 URL） */
export async function downloadFeishuAttachmentCell(
  client: Client,
  att: AttachmentCell
): Promise<{ buffer: Buffer; contentType: string }> {
  if (att.file_token) {
    return downloadFeishuAttachment(client, att.file_token);
  }
  if (att.tmp_url) {
    const r = await fetch(att.tmp_url);
    if (!r.ok) {
      throw new Error("临时链接下载失败");
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const headerCt = r.headers.get("content-type")?.split(";")[0].trim();
    const contentType =
      headerCt && headerCt !== "application/octet-stream"
        ? headerCt
        : att.type && att.type.startsWith("image/")
          ? att.type
          : "image/jpeg";
    return { buffer: buf, contentType };
  }
  throw new Error("附件缺少 file_token");
}

type FieldItem = {
  field_name?: string;
  type?: number;
  ui_type?: string;
};

function isAttachmentField(f: FieldItem): boolean {
  return f.ui_type === "Attachment" || f.type === 17;
}

function isTextField(f: FieldItem): boolean {
  return f.ui_type === "Text" || f.type === 1;
}

function extractTextCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object" && v !== null && "text" in v) {
    const t = (v as { text?: unknown }).text;
    if (typeof t === "string") return t.trim();
  }
  return "";
}

function isImageAttachment(att: AttachmentCell): boolean {
  const mime = (att.type ?? "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  const n = (att.name ?? "").toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(n);
}

export async function listAllTableFields(
  client: Client,
  appToken: string,
  tableId: string
): Promise<FieldItem[]> {
  const out: FieldItem[] = [];
  let pageToken: string | undefined;
  do {
    const res = await client.bitable.appTableField.list({
      path: { app_token: appToken, table_id: tableId },
      params: { page_size: 100, page_token: pageToken },
    });
    if (res.code !== 0) {
      throw new Error(res.msg ?? "列出字段失败");
    }
    const items = res.data?.items ?? [];
    out.push(...items);
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return out;
}

export type BitableRecordRow = {
  record_id?: string;
  fields: Record<string, unknown>;
};

export async function listAllRecords(
  client: Client,
  appToken: string,
  tableId: string
): Promise<BitableRecordRow[]> {
  const out: BitableRecordRow[] = [];
  let pageToken: string | undefined;
  do {
    const res = await client.bitable.appTableRecord.list({
      path: { app_token: appToken, table_id: tableId },
      params: {
        page_size: 500,
        page_token: pageToken,
        text_field_as_array: false,
      },
    });
    if (res.code !== 0) {
      throw new Error(res.msg ?? "列出记录失败");
    }
    const items = res.data?.items ?? [];
    for (const it of items) {
      out.push({
        record_id: it.record_id,
        fields: (it.fields ?? {}) as Record<string, unknown>,
      });
    }
    pageToken = res.data?.has_more ? res.data?.page_token : undefined;
  } while (pageToken);
  return out;
}

export function resolveFieldNames(fieldsMeta: FieldItem[]): {
  attachmentNames: string[];
  textNames: string[];
} {
  const attachmentNames: string[] = [];
  const textNames: string[] = [];
  for (const f of fieldsMeta) {
    const name = f.field_name;
    if (!name) continue;
    if (isAttachmentField(f)) attachmentNames.push(name);
    else if (isTextField(f)) textNames.push(name);
  }
  return { attachmentNames, textNames };
}

export function firstTextFromRecord(
  row: BitableRecordRow,
  textFieldNames: string[]
): string {
  for (const key of textFieldNames) {
    const v = extractTextCell(row.fields[key]);
    if (v) return v;
  }
  return "";
}

export function collectImageAttachments(
  row: BitableRecordRow,
  attachmentFieldNames: string[]
): AttachmentCell[] {
  const list: AttachmentCell[] = [];
  for (const key of attachmentFieldNames) {
    const raw = row.fields[key];
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const att = item as AttachmentCell;
      if (!att.file_token && !att.tmp_url) continue;
      if (!isImageAttachment(att)) continue;
      list.push(att);
    }
  }
  return list;
}
