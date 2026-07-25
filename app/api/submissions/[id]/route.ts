import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Powers the "resume" link customer service sends to a customer who
// generated a post but never came back to submit their XHS link — the
// submission's own id (an unguessable cuid) acts as the access token, same
// pattern as most no-login share/resume links. Only the fields needed to
// redisplay the result + submit-link screen are returned, never other
// customers' data.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const submission = await prisma.commercialSubmission.findUnique({
    where: { id },
    select: {
      name: true,
      phone: true,
      mediaPath: true,
      photoVariants: true,
      generatedContent: true,
      titleVariants: true,
      chosenTitle: true,
      xhsLink: true,
      campaign: { select: { slug: true } },
    },
  });

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id,
    name: submission.name,
    phone: submission.phone,
    mediaPath: submission.mediaPath,
    photoVariants: submission.photoVariants ? JSON.parse(submission.photoVariants) : [],
    generatedContent: submission.generatedContent,
    titleVariants: submission.titleVariants ? JSON.parse(submission.titleVariants) : [],
    chosenTitle: submission.chosenTitle,
    xhsLink: submission.xhsLink,
    campaignSlug: submission.campaign.slug,
  });
}
