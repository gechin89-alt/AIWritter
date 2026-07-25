import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const post = await prisma.individualPost.findUnique({ where: { id } });
  // Ownership check server-side — never trust that a client only ever asks
  // to delete its own rows.
  if (!post || post.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.individualPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const post = await prisma.individualPost.findUnique({ where: { id } });
  if (!post || post.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { generatedContent }: { generatedContent?: string } = await req.json();
  if (typeof generatedContent !== "string") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  await prisma.individualPost.update({ where: { id }, data: { generatedContent } });
  return NextResponse.json({ ok: true });
}
