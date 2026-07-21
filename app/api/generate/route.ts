import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readImageAsBase64 } from "@/lib/media";
import {
  generateContent,
  AiUnavailableError,
  type ChatTurn,
  type QaPair,
} from "@/lib/anthropic";
import { effectivePostLimit } from "@/lib/quota";

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
    locale,
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
    locale?: "en" | "zh";
  } = body;

  let session = null;
  if (!commercial) {
    session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admins run the app, not customers — they aren't subject to the free-post quota.
    if (session.role !== "ADMIN") {
      const [user, postCount] = await Promise.all([
        prisma.user.findUnique({
          where: { id: session.userId },
          select: { postLimit: true },
        }),
        prisma.individualPost.count({ where: { userId: session.userId } }),
      ]);
      const limit = effectivePostLimit(user?.postLimit ?? null);
      if (postCount >= limit) {
        return NextResponse.json(
          { error: "quota_exceeded", used: postCount, limit },
          { status: 402 },
        );
      }
    }
  }

  // Look the brand info up server-side from the campaign slug — never trust
  // client-supplied brand info directly, or any post could inject arbitrary text.
  let brandName: string | undefined;
  let productDescription: string | undefined;
  if (commercial && campaignSlug) {
    const campaign = await prisma.campaign.findUnique({
      where: { slug: campaignSlug },
    });
    brandName = campaign?.name;
    productDescription = campaign?.productDescription ?? undefined;
  }

  // Same idea for self-use posts: the merchant's own brand profile is looked
  // up server-side from their account, not trusted from the client.
  let brandDescription: string | undefined;
  let styleSampleText: string | undefined;
  if (!commercial && session) {
    const profileUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { brandDescription: true, styleSampleText: true },
    });
    brandDescription = profileUser?.brandDescription ?? undefined;
    styleSampleText = profileUser?.styleSampleText ?? undefined;
  }

  const image = mediaPath ? await readImageAsBase64(mediaPath) : undefined;

  let result;
  try {
    result = await generateContent({
      platform,
      identity,
      tone,
      style,
      freeText,
      commercial,
      brandName,
      productDescription,
      brandDescription,
      styleSampleText,
      category,
      qaPairs,
      imageBase64: image?.imageBase64,
      imageMediaType: image?.imageMediaType,
      history,
      locale,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
    }
    throw err;
  }

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
