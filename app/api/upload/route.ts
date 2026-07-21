import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";

const ALLOWED_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".mp4",
  ".mov",
  ".webm",
]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm"]);
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadBufferToCloudinary(buffer, {
    resourceType: VIDEO_EXT.has(ext) ? "video" : "image",
  });

  return NextResponse.json({ path: url });
}
