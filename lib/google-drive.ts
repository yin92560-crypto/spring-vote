import { JWT } from "google-auth-library";
import { google } from "googleapis";

/**
 * 从分享链接或纯 ID 解析 Google Drive 文件夹 ID。
 * 需将文件夹共享给服务账号邮箱（「读者」即可）。
 */
export function parseGoogleDriveFolderId(input: string): string | null {
  const t = input.trim();
  const folderPath = t.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderPath) return folderPath[1];
  const idParam = t.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam) return idParam[1];
  if (/^[a-zA-Z0-9_-]{15,}$/.test(t)) return t;
  return null;
}

function getDriveClient() {
  const jsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    const credentials = JSON.parse(jsonRaw) as Record<string, unknown>;
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    return google.drive({ version: "v3", auth });
  }

  const email = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error(
      "缺少 Google 凭证：请在环境变量中配置 GOOGLE_SERVICE_ACCOUNT_JSON，或 GOOGLE_DRIVE_CLIENT_EMAIL + GOOGLE_DRIVE_PRIVATE_KEY"
    );
  }

  const auth = new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

export type DriveImageFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string | null;
};

/** 列出文件夹内所有图片（非递归子文件夹） */
export async function listImageFilesInFolder(
  folderId: string
): Promise<DriveImageFile[]> {
  const drive = getDriveClient();
  const out: DriveImageFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, size)",
      pageSize: 100,
      pageToken,
    });

    for (const f of res.data.files ?? []) {
      const mime = f.mimeType ?? "";
      if (mime.startsWith("image/") && f.id) {
        out.push({
          id: f.id,
          name: f.name ?? "image",
          mimeType: mime,
          size: f.size,
        });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return out;
}

export async function downloadDriveFileBuffer(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}
