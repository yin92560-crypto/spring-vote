import { NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  buildR2PublicUrlForObjectKey,
  createWorksNestedObjectKey,
} from "@/lib/r2";

export const dynamic = "force-dynamic";

function readEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function validateR2Endpoint(endpoint: string, bucketName: string): string {
  const normalized = endpoint.replace(/\/+$/, "");
  let host = "";
  try {
    host = new URL(normalized).host.toLowerCase();
  } catch {
    throw new Error("R2_ENDPOINT is not a valid URL");
  }

  // R2 endpoint must be account-level host, not bucket-included host.
  if (host.includes(bucketName.toLowerCase())) {
    throw new Error(
      "Invalid R2_ENDPOINT: should be https://<accountid>.r2.cloudflarestorage.com (without bucket name)"
    );
  }
  return normalized;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "请上传图片文件" }, { status: 400 });
    }

    const bucketName = readEnv("R2_BUCKET_NAME");
    const endpoint = validateR2Endpoint(readEnv("R2_ENDPOINT"), bucketName);
    const accessKeyId = readEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = readEnv("R2_SECRET_ACCESS_KEY");
    const client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    const extPart = (file.name.split(".").pop() ?? "webp")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const ext = /^(webp|jpeg|jpg|png|gif)$/.test(extPart) ? extPart : "webp";
    const key = createWorksNestedObjectKey(ext);
    const body = Buffer.from(await file.arrayBuffer());

    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: file.type || "application/octet-stream",
      })
    );
    console.log("R2 Upload Status:", response);

    return NextResponse.json({
      ok: true,
      key,
      url: buildR2PublicUrlForObjectKey(key),
      etag: response.ETag ?? null,
    });
  } catch (error) {
    console.error("R2 Upload Failed:", error);
    return NextResponse.json({ error: "R2 上传失败" }, { status: 500 });
  }
}
