/**
 * Re-host a (possibly expiring) source media URL to Vercel Blob so it's durable.
 *
 * Notion file URLs are S3 pre-signed and expire in ~1h, so a stored mediaUrl
 * pointing at Notion dies. During sync we copy the bytes to Blob under a stable
 * key and store the Blob URL instead.
 *
 * Gated: if BLOB_READ_WRITE_TOKEN (or the @vercel/blob package) is missing, this
 * returns the source URL unchanged — a no-op — so sync still works without Blob.
 */

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("avif")) return ".avif";
  if (ct.includes("gif")) return ".gif";
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
  if (ct.includes("mp4") || ct.includes("video")) return ".mp4";
  return "";
}

export async function rehostToBlob(sourceUrl: string | undefined, keyBase: string): Promise<string | undefined> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!sourceUrl || !token) return sourceUrl; // not configured → leave as-is
  try {
    const { put } = await import("@vercel/blob");
    const res = await fetch(sourceUrl);
    if (!res.ok) return sourceUrl;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "";
    const { url } = await put(`${keyBase}${extFromContentType(ct)}`, buf, {
      access: "public",
      token,
      contentType: ct || undefined,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return url;
  } catch (e) {
    console.warn("[rehost] Blob re-host skipped:", e instanceof Error ? e.message : e);
    return sourceUrl;
  }
}
