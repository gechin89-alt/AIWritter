import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readImageAsBase64 } from "@/lib/media";
import { generateFollowUpQuestions, AiUnavailableError } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const {
    category,
    mediaPath,
    campaignSlug,
  }: { category?: string; mediaPath?: string; campaignSlug?: string } = await req.json();

  if (!category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 });
  }

  const image = mediaPath ? await readImageAsBase64(mediaPath) : undefined;

  // Brand context is looked up server-side, never trusted from the client,
  // same pattern as the photo-styling and generate routes.
  const campaign = campaignSlug
    ? await prisma.campaign.findUnique({
        where: { slug: campaignSlug },
        select: { name: true, productDescription: true },
      })
    : null;

  try {
    const questions = await generateFollowUpQuestions({
      category,
      imageBase64: image?.imageBase64,
      imageMediaType: image?.imageMediaType,
      brandName: campaign?.name,
      productDescription: campaign?.productDescription ?? undefined,
    });
    return NextResponse.json({ questions });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
    }
    throw err;
  }
}
