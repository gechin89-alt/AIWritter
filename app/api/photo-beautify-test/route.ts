import { NextRequest, NextResponse } from "next/server";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { applyBeautifyOnly, type TrendStyle } from "@/lib/image-filter";
import { restoreDetail } from "@/lib/realesrgan";
import { fetchAsBuffer } from "@/lib/cloudinary";

// Temporary test-only endpoint: runs a curated trend-style color grade plus
// an optional caption/polaroid frame and an optional AI detail-restore pass
// (Real-ESRGAN, local Windows binary — dev-only, does not work in production
// serverless hosting) — for cost-free iteration.
export async function POST(req: NextRequest) {
  const {
    mediaPath,
    trendStyle,
    captionText,
    polaroid,
    detailRestore,
  }: {
    mediaPath?: string;
    trendStyle?: TrendStyle;
    captionText?: string;
    polaroid?: boolean;
    detailRestore?: boolean;
  } = await req.json();
  if (!mediaPath) {
    return NextResponse.json({ error: "Missing mediaPath" }, { status: 400 });
  }

  const ext = path.extname(mediaPath).toLowerCase().split("?")[0];
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return NextResponse.json({ path: mediaPath, filtered: false });
  }

  let tempInputPath: string | null = null;
  let restoredAbsolutePath: string | null = null;
  try {
    let inputBuffer = await fetchAsBuffer(mediaPath);

    if (detailRestore) {
      tempInputPath = path.join(os.tmpdir(), `${randomUUID()}${ext}`);
      await writeFile(tempInputPath, inputBuffer);
      restoredAbsolutePath = await restoreDetail(tempInputPath);
      inputBuffer = await readFile(restoredAbsolutePath);
    }

    const resultPath = await applyBeautifyOnly(inputBuffer, { trendStyle, captionText, polaroid });
    return NextResponse.json({ path: resultPath, filtered: true });
  } catch {
    return NextResponse.json({ path: mediaPath, filtered: false });
  } finally {
    if (tempInputPath) await unlink(tempInputPath).catch(() => {});
    if (restoredAbsolutePath) await unlink(restoredAbsolutePath).catch(() => {});
  }
}
