import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { applyBrandStyle } from "@/lib/image-filter";
import { analyzePhotoForStyling, AiUnavailableError } from "@/lib/anthropic";
import { readImageAsBase64 } from "@/lib/media";
import { fetchAsBuffer } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  const {
    mediaPath,
    campaignSlug,
    locale,
  }: { mediaPath?: string; campaignSlug?: string; locale?: "en" | "zh" } = await req.json();

  if (!mediaPath || !campaignSlug) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Brand color/logo are looked up server-side from the campaign — never
  // trust client-supplied styling, same pattern as brand name/description.
  const campaign = await prisma.campaign.findUnique({
    where: { slug: campaignSlug },
    select: {
      brandColor: true,
      logoPath: true,
      logoWatermarkEnabled: true,
      name: true,
      productDescription: true,
    },
  });

  if (!campaign?.brandColor && !campaign?.logoPath) {
    return NextResponse.json({ path: mediaPath, variants: [], filtered: false });
  }

  const ext = path.extname(mediaPath).toLowerCase().split("?")[0];
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
    return NextResponse.json({ path: mediaPath, variants: [], filtered: false });
  }

  try {
    const image = await readImageAsBase64(mediaPath);
    if (!image) {
      return NextResponse.json({ path: mediaPath, variants: [], filtered: false });
    }

    const plans = await analyzePhotoForStyling({
      imageBase64: image.imageBase64,
      imageMediaType: image.imageMediaType,
      brandName: campaign.name,
      productDescription: campaign.productDescription ?? undefined,
      locale,
    });

    const inputBuffer = Buffer.from(image.imageBase64, "base64");
    const logoBuffer =
      campaign.logoPath && campaign.logoWatermarkEnabled
        ? await fetchAsBuffer(campaign.logoPath)
        : null;

    const variants = (
      await Promise.all(
        plans.map((plan) =>
          applyBrandStyle(inputBuffer, {
            stylePreset: plan.stylePreset,
            brandColorHex: campaign.brandColor,
            hookText: plan.hookText,
            logoBuffer,
            logoPosition: plan.logoPosition,
          }),
        ),
      )
    ).filter((p): p is string => Boolean(p));

    if (variants.length === 0) {
      return NextResponse.json({ path: mediaPath, variants: [], filtered: false });
    }
    return NextResponse.json({ path: variants[0], variants, filtered: true });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return NextResponse.json({ path: mediaPath, variants: [], filtered: false, aiUnavailable: true });
    }
    return NextResponse.json({ path: mediaPath, variants: [], filtered: false });
  }
}
