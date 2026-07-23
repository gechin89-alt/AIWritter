import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body: {
    active?: boolean;
    name?: string;
    brandLink?: string;
    brandColor?: string;
    logoPath?: string | null;
    logoWatermarkEnabled?: boolean;
    productDescription?: string;
    prizeInfo?: string;
    termsText?: string;
    identityOptions?: string[];
    toneOptions?: string[];
    styleOptions?: string[];
    identityQuestion?: string;
    toneQuestion?: string;
    styleQuestion?: string;
    identityIncludeOther?: boolean;
    toneIncludeOther?: boolean;
    styleIncludeOther?: boolean;
    identityMultiSelect?: boolean;
    toneMultiSelect?: boolean;
    styleMultiSelect?: boolean;
    questionMode?: "FIXED" | "AI_ADAPTIVE";
  } = await req.json();

  const data: Record<string, unknown> = {};
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.name !== undefined) data.name = body.name;
  if (body.brandLink !== undefined) data.brandLink = body.brandLink;
  if (body.brandColor !== undefined)
    data.brandColor =
      body.brandColor && /^#[0-9a-fA-F]{6}$/.test(body.brandColor.trim())
        ? body.brandColor.trim()
        : null;
  if (body.logoPath !== undefined) data.logoPath = body.logoPath || null;
  if (body.logoWatermarkEnabled !== undefined)
    data.logoWatermarkEnabled = Boolean(body.logoWatermarkEnabled);
  if (body.productDescription !== undefined)
    data.productDescription = body.productDescription || null;
  if (body.prizeInfo !== undefined) data.prizeInfo = body.prizeInfo;
  if (body.termsText !== undefined) data.termsText = body.termsText;
  if (body.identityOptions !== undefined)
    data.identityOptions = body.identityOptions.length
      ? JSON.stringify(body.identityOptions)
      : null;
  if (body.toneOptions !== undefined)
    data.toneOptions = body.toneOptions.length
      ? JSON.stringify(body.toneOptions)
      : null;
  if (body.styleOptions !== undefined)
    data.styleOptions = body.styleOptions.length
      ? JSON.stringify(body.styleOptions)
      : null;
  if (body.identityQuestion !== undefined)
    data.identityQuestion = body.identityQuestion || null;
  if (body.toneQuestion !== undefined)
    data.toneQuestion = body.toneQuestion || null;
  if (body.styleQuestion !== undefined)
    data.styleQuestion = body.styleQuestion || null;
  if (body.identityIncludeOther !== undefined)
    data.identityIncludeOther = Boolean(body.identityIncludeOther);
  if (body.toneIncludeOther !== undefined)
    data.toneIncludeOther = Boolean(body.toneIncludeOther);
  if (body.styleIncludeOther !== undefined)
    data.styleIncludeOther = Boolean(body.styleIncludeOther);
  if (body.identityMultiSelect !== undefined)
    data.identityMultiSelect = Boolean(body.identityMultiSelect);
  if (body.toneMultiSelect !== undefined)
    data.toneMultiSelect = Boolean(body.toneMultiSelect);
  if (body.styleMultiSelect !== undefined)
    data.styleMultiSelect = Boolean(body.styleMultiSelect);
  if (body.questionMode !== undefined)
    data.questionMode = body.questionMode === "AI_ADAPTIVE" ? "AI_ADAPTIVE" : "FIXED";

  const campaign = await prisma.campaign.update({
    where: { id },
    data,
  });

  return NextResponse.json(campaign);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const submissionCount = await prisma.commercialSubmission.count({
    where: { campaignId: id },
  });
  if (submissionCount > 0) {
    return NextResponse.json(
      {
        error:
          "This campaign has submissions and cannot be deleted. Deactivate it instead.",
      },
      { status: 409 },
    );
  }

  await prisma.campaign.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
