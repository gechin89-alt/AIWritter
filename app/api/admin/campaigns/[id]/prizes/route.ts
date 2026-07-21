import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const {
    prizes,
  }: {
    prizes: {
      rank: number;
      name: string;
      description?: string;
      imagePath?: string;
      qty?: number;
    }[];
  } = await req.json();

  await prisma.$transaction([
    prisma.prize.deleteMany({ where: { campaignId: id } }),
    prisma.prize.createMany({
      data: (prizes ?? []).map((p) => ({
        campaignId: id,
        rank: p.rank,
        name: p.name,
        description: p.description ?? null,
        imagePath: p.imagePath ?? null,
        qty: Number.isInteger(p.qty) ? p.qty : null,
      })),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
