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
    brandColor,
    logoPath,
    logoWatermarkEnabled,
    productDescription,
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
    identityMultiSelect,
    toneMultiSelect,
    styleMultiSelect,
    questionMode,
    prizes,
  }: {
    slug: string;
    name: string;
    brandLink: string;
    brandColor?: string;
    logoPath?: string;
    logoWatermarkEnabled?: boolean;
    productDescription?: string;
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
    identityMultiSelect?: boolean;
    toneMultiSelect?: boolean;
    styleMultiSelect?: boolean;
    questionMode?: "FIXED" | "AI_ADAPTIVE";
    prizes?: {
      rank: number;
      name: string;
      description?: string;
      imagePath?: string;
      qty?: number;
    }[];
  } = await req.json();

  if (!slug || !name || !brandLink) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
      { status: 400 },
    );
  }

  const validBrandColor =
    brandColor && /^#[0-9a-fA-F]{6}$/.test(brandColor.trim()) ? brandColor.trim() : null;

  const campaign = await prisma.campaign.create({
    data: {
      slug,
      name,
      brandLink,
      brandColor: validBrandColor,
      logoPath: logoPath || null,
      logoWatermarkEnabled: logoWatermarkEnabled ?? true,
      productDescription: productDescription || null,
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
      identityMultiSelect: Boolean(identityMultiSelect),
      toneMultiSelect: Boolean(toneMultiSelect),
      styleMultiSelect: Boolean(styleMultiSelect),
      questionMode: questionMode === "AI_ADAPTIVE" ? "AI_ADAPTIVE" : "FIXED",
      prizes: prizes?.length
        ? {
            create: prizes.map((p) => ({
              rank: p.rank,
              name: p.name,
              description: p.description ?? null,
              imagePath: p.imagePath ?? null,
              qty: Number.isInteger(p.qty) ? p.qty : null,
            })),
          }
        : undefined,
    },
  });

  return NextResponse.json(campaign);
}
