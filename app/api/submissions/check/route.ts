import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_EDIT_LIMIT = 3;

/**
 * Called right after the contact step (name+phone), before any Q&A - looks
 * up whether this phone has already touched this campaign so we can: block
 * a second lucky-draw entry for a phone that already posted (fairness),
 * resume an existing in-progress draft instead of starting over, or create
 * a fresh draft row up front so editCount can be tracked from the very
 * first generation.
 */
export async function POST(req: NextRequest) {
  const { campaignSlug, name, phone }: { campaignSlug?: string; name?: string; phone?: string } =
    await req.json();

  if (!campaignSlug || !name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({ where: { slug: campaignSlug } });
  if (!campaign || !campaign.active) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const existing = await prisma.commercialSubmission.findFirst({
    where: { campaignId: campaign.id, phone: phone.trim() },
  });

  if (existing && (existing.status === "POSTED" || existing.status === "VERIFIED")) {
    return NextResponse.json({
      status: "blocked",
      submission: {
        id: existing.id,
        generatedContent: existing.generatedContent,
        mediaPath: existing.mediaPath,
        xhsLink: existing.xhsLink,
      },
    });
  }

  if (existing) {
    // Keep the name in sync in case they typed it slightly differently this
    // time, but otherwise resume exactly where they left off.
    const updated = await prisma.commercialSubmission.update({
      where: { id: existing.id },
      data: { name: name.trim() },
    });
    return NextResponse.json({
      status: "resume",
      submission: {
        id: updated.id,
        mediaPath: updated.mediaPath,
        photoVariants: updated.photoVariants ? JSON.parse(updated.photoVariants) : [],
        generatedContent: updated.generatedContent,
        titleVariants: updated.titleVariants ? JSON.parse(updated.titleVariants) : [],
        chosenTitle: updated.chosenTitle,
        editCount: updated.editCount,
        editLimit: updated.editLimitOverride ?? DEFAULT_EDIT_LIMIT,
      },
    });
  }

  const created = await prisma.commercialSubmission.create({
    data: { campaignId: campaign.id, name: name.trim(), phone: phone.trim() },
  });
  return NextResponse.json({
    status: "new",
    submission: {
      id: created.id,
      editCount: 0,
      editLimit: DEFAULT_EDIT_LIMIT,
    },
  });
}
