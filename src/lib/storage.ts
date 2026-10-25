import "server-only";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { requireEnv } from "@/env";

/** Cloudflare R2 through its S3-compatible API. */

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

let client: S3Client | undefined;

function r2() {
  const e = requireEnv("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL");
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
  });
  return { client, bucket: e.R2_BUCKET, publicUrl: e.R2_PUBLIC_URL.replace(/\/$/, "") };
}

/**
 * Returns a short-lived URL the browser can PUT a file to, plus the public URL
 * the file will have. `folder` is e.g. "logos" or "gallery".
 */
export async function createUploadUrl(args: { folder: string; contentType: string; contentLength: number }) {
  const ext = ALLOWED_TYPES[args.contentType];
  if (!ext) throw new Error("Unsupported file type");
  if (args.contentLength <= 0 || args.contentLength > MAX_UPLOAD_BYTES) throw new Error("File too large (max 5 MB)");
  if (!/^[a-z0-9-]+$/.test(args.folder)) throw new Error("Invalid folder");

  const { client, bucket, publicUrl } = r2();
  const key = `${args.folder}/${randomUUID()}.${ext}`;
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: args.contentType,
      ContentLength: args.contentLength,
    }),
    { expiresIn: 300 },
  );
  return { key, uploadUrl, publicUrl: `${publicUrl}/${key}` };
}

/** Server-side upload, e.g. evidence screenshots captured by workers. */
export async function putObject(key: string, body: Uint8Array, contentType: string) {
  const { client, bucket, publicUrl } = r2();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  return `${publicUrl}/${key}`;
}

export async function deleteObject(key: string) {
  const { client, bucket } = r2();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
