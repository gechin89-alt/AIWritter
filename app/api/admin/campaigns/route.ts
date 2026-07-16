import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    slug,
    name,
    brandLink,
    prizeInfo,
    termsText,
    identityOptions,
    toneOptions,
    styleOptions,
    identityQuestion,
    toneQuestion,
    styleQuestion,
    identityIncludeOther,
    toneIncludeOther,
    styleIncludeOther,
    questionMode,
  }: {
    slug: string;
    name: string;
    brandLink: string;
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
    questionMode?: "FIXED" | "AI_ADAPTIVE";
  } = await req.json();

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
      identityOptions: identityOptions ? JSON.stringify(identityOptions) : null,
      toneOptions: toneOptions ? JSON.stringify(toneOptions) : null,
      styleOptions: styleOptions ? JSON.stringify(styleOptions) : null,
      identityQuestion: identityQuestion || null,
      toneQuestion: toneQuestion || null,
      styleQuestion: styleQuestion || null,
      identityIncludeOther: Boolean(identityIncludeOther),
      toneIncludeOther: Boolean(toneIncludeOther),
      styleIncludeOther: Boolean(styleIncludeOther),
      questionMode: questionMode === "AI_ADAPTIVE" ? "AI_ADAPTIVE" : "FIXED",
    },
  });

  return NextResponse.json(campaign);
}
