import { readFile } from "node:fs/promises";
import path from "node:path";

const MEDIA_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function readImageAsBase64(
  mediaPath: string,
): Promise<{ imageBase64: string; imageMediaType: string } | undefined> {
  const ext = path.extname(mediaPath).toLowerCase();
  const mimeType = MEDIA_TYPES[ext];
  if (!mimeType) return undefined;

  try {
    const filePath = path.join(process.cwd(), "public", mediaPath);
    const buffer = await readFile(filePath);
    return { imageBase64: buffer.toString("base64"), imageMediaType: mimeType };
  } catch {
    return undefined;
  }
}
