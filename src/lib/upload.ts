/**
 * Sends a file straight from the browser to R2 with a presigned URL. A network
 * error here is almost always the bucket's CORS policy refusing this site's
 * origin (README → Cloudflare R2), so say that instead of "Failed to fetch".
 */
export async function putToStorage(uploadUrl: string, file: File): Promise<void> {
  let res: Response;
  try {
    res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  } catch {
    throw new Error("The upload couldn't reach file storage. Try again in a minute; if it keeps failing, let us know.");
  }
  if (!res.ok) throw new Error(`Upload failed (storage returned HTTP ${res.status}).`);
}
