import { NextRequest, NextResponse } from "next/server";
import { readImageAsBase64 } from "@/lib/media";
import { generateFollowUpQuestions, AiUnavailableError } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const { category, mediaPath }: { category?: string; mediaPath?: string } =
    await req.json();

  if (!category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 });
  }

  const image = mediaPath ? await readImageAsBase64(mediaPath) : undefined;

  try {
    const questions = await generateFollowUpQuestions({
      category,
      imageBase64: image?.imageBase64,
      imageMediaType: image?.imageMediaType,
    });
    return NextResponse.json({ questions });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
    }
    throw err;
  }
}
