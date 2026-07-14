import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { name, phone, password, locale } = await req.json();

  if (!name || !phone || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return NextResponse.json(
      { error: "Phone number already registered" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, phone, passwordHash, locale: locale ?? "en" },
  });

  await setSessionCookie({ userId: user.id, role: user.role });

  return NextResponse.json({ id: user.id, name: user.name, role: user.role });
}
