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

  // Upserts the same row (by submissionId) instead of creating a new one each
  // time, so one customer's journey (generated -> gave contact -> posted)
  // shows up as a single row, not three.
  const existing = submissionId
    ? await prisma.commercialSubmission.findUnique({ where: { id: submissionId } })
    : null;

  // Fairness: one phone gets exactly one lucky-draw entry per campaign. The
  // contact-step /api/submissions/check endpoint is the normal gate for
  // this, but finalizing a submission without having gone through it (or a
  // stale/reused submissionId) shouldn't be able to slip past - re-check
  // here too before letting a second entry go POSTED.
  if (phone && xhsLink) {
    const alreadyPosted = await prisma.commercialSubmission.findFirst({
      where: {
        campaignId: campaign.id,
        phone,
        status: { in: ["POSTED", "VERIFIED"] },
        ...(existing ? { NOT: { id: existing.id } } : {}),
      },
    });
    if (alreadyPosted) {
      return NextResponse.json({ error: "already_submitted" }, { status: 409 });
    }
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

  const submission =
    existing && existing.campaignId === campaign.id
      ? await prisma.commercialSubmission.update({ where: { id: existing.id }, data })
      : await prisma.commercialSubmission.create({
          data: { campaignId: campaign.id, ...data },
        });

  return NextResponse.json({ id: submission.id });
}
