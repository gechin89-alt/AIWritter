import sharp from "sharp";
import { fetchAsBuffer } from "./cloudinary";

const FORMAT_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export async function readImageAsBase64(
  mediaUrl: string,
): Promise<{ imageBase64: string; imageMediaType: string } | undefined> {
  try {
    const buffer = await fetchAsBuffer(mediaUrl);

    // Detect the real format from the file's actual content rather than
    // trusting its extension — a mismatched declared media type (e.g. a
    // .jpg file that is actually WEBP-encoded) gets rejected by Claude's API.
    const metadata = await sharp(buffer).metadata();
    const mimeType = metadata.format ? FORMAT_TO_MIME[metadata.format] : undefined;
    if (!mimeType) return undefined;

    return { imageBase64: buffer.toString("base64"), imageMediaType: mimeType };
  } catch {
    return undefined;
  }
}
