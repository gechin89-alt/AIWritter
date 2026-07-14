import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug, name, brandLink, prizeInfo, termsText } = await req.json();

  if (!slug || !name || !brandLink) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      slug,
      name,
      brandLink,
      prizeInfo: prizeInfo ?? "",
      termsText: termsText ?? "",
    },
  });

  return NextResponse.json(campaign);
}
