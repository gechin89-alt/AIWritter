import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_EDIT_LIMIT = 3;
const GRANT_INCREMENT = 3;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { action }: { action?: "reset" | "grant" } = await req.json();

  const submission = await prisma.commercialSubmission.findUnique({ where: { id } });
  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated =
    action === "reset"
      ? await prisma.commercialSubmission.update({ where: { id }, data: { editCount: 0 } })
      : await prisma.commercialSubmission.update({
          where: { id },
          data: {
            editLimitOverride: (submission.editLimitOverride ?? DEFAULT_EDIT_LIMIT) + GRANT_INCREMENT,
          },
        });

  return NextResponse.json({
    editCount: updated.editCount,
    editLimit: updated.editLimitOverride ?? DEFAULT_EDIT_LIMIT,
  });
}
