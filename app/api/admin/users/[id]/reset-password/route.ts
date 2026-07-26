import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Excludes visually ambiguous characters (0/O, 1/l/I) since this gets read
// aloud or retyped from a WhatsApp message.
const TEMP_PASSWORD_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateTempPassword(length = 8): string {
  return Array.from({ length }, () => TEMP_PASSWORD_CHARS[randomInt(TEMP_PASSWORD_CHARS.length)]).join("");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { newPassword }: { newPassword?: string } = await req.json().catch(() => ({}));
  if (newPassword !== undefined && newPassword.trim().length < 6) {
    return NextResponse.json({ error: "Password too short" }, { status: 400 });
  }

  const { id } = await params;
  const tempPassword = newPassword?.trim() || generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await prisma.user.update({ where: { id }, data: { passwordHash } });

  // Only ever returned once, right after generation — not stored anywhere
  // in plaintext, same as a normal password. When the admin chose the
  // password themselves they already know it, but returning it too keeps
  // this response shape uniform for the client.
  return NextResponse.json({ tempPassword });
}
