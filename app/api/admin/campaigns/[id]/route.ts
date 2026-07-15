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
  const { active } = await req.json();

  const campaign = await prisma.campaign.update({
    where: { id },
    data: { active: Boolean(active) },
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
