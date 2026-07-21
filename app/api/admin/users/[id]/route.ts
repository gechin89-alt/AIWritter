import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { postLimit }: { postLimit: number | null } = await req.json();

  const user = await prisma.user.update({
    where: { id },
    data: {
      postLimit:
        postLimit === null || Number.isNaN(postLimit) ? null : Math.max(0, postLimit),
    },
  });

  return NextResponse.json({ id: user.id, postLimit: user.postLimit });
}
