import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { campaignSlug, name, phone, mediaPath, generatedContent, xhsLink } =
    await req.json();

  if (!campaignSlug || !name || !phone || !xhsLink) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { slug: campaignSlug },
  });
  if (!campaign || !campaign.active) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const submission = await prisma.commercialSubmission.create({
    data: {
      campaignId: campaign.id,
      name,
      phone,
      mediaPath,
      generatedContent,
      xhsLink,
      status: "POSTED",
    },
  });

  const entryCount = await prisma.commercialSubmission.count({
    where: { campaignId: campaign.id, phone },
  });

  return NextResponse.json({ id: submission.id, entryCount });
}
