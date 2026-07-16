import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readImageAsBase64 } from "@/lib/media";
import { generateContent, type ChatTurn, type QaPair } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    platform,
    identity,
    tone,
    style,
    freeText,
    commercial,
    campaignSlug,
    category,
    qaPairs,
    mediaPath,
    history,
  }: {
    platform: "XHS" | "INSTAGRAM";
    identity?: string;
    tone?: string;
    style?: string;
    freeText?: string;
    commercial?: boolean;
    campaignSlug?: string;
    category?: string;
    qaPairs?: QaPair[];
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

  // Look the brand name up server-side from the campaign slug — never trust
  // a client-supplied brand name directly, or any post could inject arbitrary text.
  let brandName: string | undefined;
  if (commercial && campaignSlug) {
    const campaign = await prisma.campaign.findUnique({
      where: { slug: campaignSlug },
    });
    brandName = campaign?.name;
  }

  const image = mediaPath ? await readImageAsBase64(mediaPath) : undefined;

  const result = await generateContent({
    platform,
    identity,
    tone,
    style,
    freeText,
    commercial,
    brandName,
    category,
    qaPairs,
    imageBase64: image?.imageBase64,
    imageMediaType: image?.imageMediaType,
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
