import { createAdminClient } from "@/lib/supabase/admin";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
};

export function extensionFromMime(mime: string): string {
  return MIME_TO_EXT[mime.toLowerCase()] ?? "jpg";
}

/** 服务端：将图片写入 Storage 并插入 works（与 /api/works POST 逻辑一致） */
export async function insertWorkFromImageBuffer(opts: {
  buffer: Buffer;
  contentType: string;
  title: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const supabase = createAdminClient();
    const workId = crypto.randomUUID();
    const ext = extensionFromMime(opts.contentType);
    const path = `works/${workId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("photos")
      .upload(path, opts.buffer, {
        contentType: opts.contentType || "image/jpeg",
        upsert: false,
      });

    if (upErr) {
      console.error(upErr);
      return { ok: false, error: "图片上传失败" };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("photos").getPublicUrl(path);

    const { error: insErr } = await supabase.from("works").insert({
      id: workId,
      title: opts.title.trim() || "未命名作品",
      image_path: path,
      image_url: publicUrl,
    });

    if (insErr) {
      console.error(insErr);
      await supabase.storage.from("photos").remove([path]);
      return { ok: false, error: "保存作品失败" };
    }

    return { ok: true, id: workId };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "服务器错误" };
  }
}
