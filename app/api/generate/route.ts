import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateContent, type ChatTurn } from "@/lib/anthropic";

const MEDIA_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    platform,
    identity,
    tone,
    style,
    freeText,
    commercial,
    mediaPath,
    history,
  }: {
    platform: "XHS" | "INSTAGRAM";
    identity?: string;
    tone?: string;
    style?: string;
    freeText?: string;
    commercial?: boolean;
    mediaPath?: string;
    history?: ChatTurn[];
  } = body;

  let session = null;
  if (!commercial) {
    session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let imageBase64: string | undefined;
  let imageMediaType: string | undefined;

  if (mediaPath) {
    const ext = path.extname(mediaPath).toLowerCase();
    const mimeType = MEDIA_TYPES[ext];
    if (mimeType) {
      try {
        const filePath = path.join(process.cwd(), "public", mediaPath);
        const buffer = await readFile(filePath);
        imageBase64 = buffer.toString("base64");
        imageMediaType = mimeType;
      } catch {
        // media not readable (e.g. video) — proceed without it
      }
    }
  }

  const result = await generateContent({
    platform,
    identity,
    tone,
    style,
    freeText,
    commercial,
    imageBase64,
    imageMediaType,
    history,
  });

  if (result.type === "result" && session) {
    await prisma.individualPost.create({
      data: {
        userId: session.userId,
        mediaPath,
        identity,
        tone,
        style,
        freeText,
        platform,
        clarifyingHistory: JSON.stringify(history ?? []),
        generatedContent: result.content,
        status: "generated",
      },
    });
  }

  return NextResponse.json(result);
}
