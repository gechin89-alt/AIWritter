import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { brandDescription: true, styleSampleText: true, brandImagePaths: true },
  });

  return NextResponse.json({
    brandDescription: user?.brandDescription ?? "",
    styleSampleText: user?.styleSampleText ?? "",
    brandImagePaths: user?.brandImagePaths ? JSON.parse(user.brandImagePaths) : [],
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    brandDescription,
    styleSampleText,
    brandImagePaths,
  }: { brandDescription?: string; styleSampleText?: string; brandImagePaths?: string[] } =
    await req.json();

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      brandDescription: brandDescription?.trim() || null,
      styleSampleText: styleSampleText?.trim() || null,
      brandImagePaths:
        brandImagePaths && brandImagePaths.length > 0 ? JSON.stringify(brandImagePaths) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
