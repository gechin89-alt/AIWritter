import { NextRequest, NextResponse } from "next/server";
import { readImageAsBase64 } from "@/lib/media";
import { generateFollowUpQuestions } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const { category, mediaPath }: { category?: string; mediaPath?: string } =
    await req.json();

  if (!category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 });
  }

  const image = mediaPath ? await readImageAsBase64(mediaPath) : undefined;

  const questions = await generateFollowUpQuestions({
    category,
    imageBase64: image?.imageBase64,
    imageMediaType: image?.imageMediaType,
  });

  return NextResponse.json({ questions });
}
