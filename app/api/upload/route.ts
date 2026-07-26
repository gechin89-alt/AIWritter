import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { uploadBufferToCloudinary, fetchAsBuffer } from "@/lib/cloudinary";
import { removeWhiteBackground } from "@/lib/image-filter";

const ALLOWED_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".mp4",
  ".mov",
  ".webm",
]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm"]);
const HEIC_EXT = new Set([".heic", ".heif"]);
const MAX_SIZE_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 415 },
    );
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  const isLogo = formData.get("type") === "logo";
  const isVideo = VIDEO_EXT.has(ext);
  const isHeic = HEIC_EXT.has(ext);

  try {
    if (isLogo && !isVideo) {
      if (isHeic) {
        // sharp/libvips in this environment can't reliably decode real
        // iPhone/Android HEIC photos (the HEVC codec usually isn't bundled
        // even when the format is "registered") — let Cloudinary convert it
        // server-side first, then re-fetch the now-JPEG bytes to remove the
        // white background locally.
        const convertedUrl = await uploadBufferToCloudinary(buffer, {
          resourceType: "image",
          format: "jpg",
        });
        buffer = await fetchAsBuffer(convertedUrl);
      }
      // Free alternative to Cloudinary's paid background-removal add-on — fades
      // a flat white background to transparent so logos don't composite onto
      // photos as an ugly white square.
      buffer = await removeWhiteBackground(buffer);
    }

    const url = await uploadBufferToCloudinary(buffer, {
      resourceType: isVideo ? "video" : "image",
      // Forcing a real, universally-decodable format at the Cloudinary layer
      // (rather than trusting the original bytes) avoids relying on sharp's
      // HEIC support downstream — same fix class as the earlier WEBP/JPEG
      // mismatch bug.
      format: isLogo ? "png" : isHeic ? "jpg" : undefined,
    });

    return NextResponse.json({ path: url });
  } catch (err) {
    // Without this, an uncaught exception here (a bad HEIC file Cloudinary
    // itself rejects, a Cloudinary API error, a sharp failure on a malformed
    // image) fell through to Next's generic 500 handler, which doesn't
    // return a JSON body — the client only ever saw "unknown" as the reason,
    // making it undiagnosable from what the customer could report back.
    const message = err instanceof Error ? err.message : String(err);
    console.error("upload failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
