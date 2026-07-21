import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const {
    submissionId,
    campaignSlug,
    name,
    phone,
    mediaPath,
    photoVariants,
    generatedContent,
    titleVariants,
    chosenTitle,
    xhsLink,
  } = await req.json();

  // name/phone are optional here so a draft can be saved as soon as a photo
  // style + title are chosen — before the customer has reached the contact
  // form — so admin can see total-generated vs. total-posted counts. The
  // final "submit with link" step still requires name/phone client-side.
  if (!campaignSlug) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { slug: campaignSlug },
  });
  if (!campaign || !campaign.active) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const data = {
    name: name || undefined,
    phone: phone || undefined,
    mediaPath,
    photoVariants: photoVariants ? JSON.stringify(photoVariants) : undefined,
    generatedContent,
    titleVariants: titleVariants ? JSON.stringify(titleVariants) : undefined,
    chosenTitle,
    xhsLink: xhsLink || undefined,
    status: xhsLink ? ("POSTED" as const) : ("DRAFT" as const),
  };

  // Upserts the same row (by submissionId) instead of creating a new one each
  // time, so one customer's journey (generated -> gave contact -> posted)
  // shows up as a single row, not three.
  const existing = submissionId
    ? await prisma.commercialSubmission.findUnique({ where: { id: submissionId } })
    : null;

  const submission =
    existing && existing.campaignId === campaign.id
      ? await prisma.commercialSubmission.update({ where: { id: existing.id }, data })
      : await prisma.commercialSubmission.create({
          data: { campaignId: campaign.id, ...data },
        });

  // Only POSTED submissions (a real, verifiable link) count toward the lucky
  // draw, and only once we actually have a phone number to count by.
  const entryCount = phone
    ? await prisma.commercialSubmission.count({
        where: { campaignId: campaign.id, phone, status: "POSTED" },
      })
    : 0;

  return NextResponse.json({ id: submission.id, entryCount });
}
