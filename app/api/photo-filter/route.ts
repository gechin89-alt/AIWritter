import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { applyBrandStyle, pickRandomTrendStyles } from "@/lib/image-filter";
import { analyzePhotoForStyling, AiUnavailableError, type PhotoStylingPlan, type TextMode } from "@/lib/anthropic";
import { readImageAsBase64 } from "@/lib/media";
import { fetchAsBuffer } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  const {
    mediaPath,
    campaignSlug,
    locale,
    textMode: rawTextMode,
    customText,
  }: {
    mediaPath?: string;
    campaignSlug?: string;
    locale?: "en" | "zh";
    textMode?: TextMode;
    customText?: string;
  } = await req.json();

  if (!mediaPath) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const textMode: TextMode = rawTextMode ?? "auto";

  // Brand color/logo are looked up server-side — never trust client-supplied
  // styling. Two sources: a commercial campaign (by slug), or the logged-in
  // user's own profile for the self-serve 品牌自营 flow (no slug given).
  let brandColorHex: string | null = null;
  let logoPath: string | null = null;
  let logoWatermarkEnabled = true;
  let brandName: string | undefined;
  let productDescription: string | undefined;

  if (campaignSlug) {
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
    if (!campaign) {
      return NextResponse.json({ path: mediaPath, variants: [], filtered: false });
    }
    // Commercial campaigns only get styled once an admin has opted in by
    // setting a brand color or logo — avoids applying random styling to
    // campaigns nobody configured a look for.
    if (!campaign.brandColor && !campaign.logoPath) {
      return NextResponse.json({ path: mediaPath, variants: [], filtered: false });
    }
    brandColorHex = campaign.brandColor;
    logoPath = campaign.logoPath;
    logoWatermarkEnabled = campaign.logoWatermarkEnabled;
    brandName = campaign.name;
    productDescription = campaign.productDescription ?? undefined;
  } else {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { brandColor: true, logoPath: true, logoWatermarkEnabled: true, brandDescription: true, name: true },
    });
    // Personalizing the photo is the whole point of 品牌自营 — unlike
    // campaigns, styling always applies here even if the user hasn't set a
    // brand color/logo yet; those are optional extras layered on top.
    brandColorHex = user?.brandColor ?? null;
    logoPath = user?.logoPath ?? null;
    logoWatermarkEnabled = user?.logoWatermarkEnabled ?? true;
    brandName = user?.name;
    productDescription = user?.brandDescription ?? undefined;
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

    const inputBuffer = Buffer.from(image.imageBase64, "base64");
    const logoBuffer = logoPath && logoWatermarkEnabled ? await fetchAsBuffer(logoPath) : null;

    const rawPlans = await analyzePhotoForStyling({
      imageBase64: image.imageBase64,
      imageMediaType: image.imageMediaType,
      brandName,
      productDescription,
      locale,
      textMode,
      customText,
      needsLogoPosition: Boolean(logoBuffer),
    });

    // "custom"/"none" modes return a single shared plan (the text itself
    // doesn't vary, only the trend style does) — reuse it across all 3
    // variants. "auto" already returns up to 3 distinct plans.
    const plans: PhotoStylingPlan[] =
      textMode === "auto" ? rawPlans : [rawPlans[0], rawPlans[0], rawPlans[0]].filter(Boolean);

    // Randomly assign a DISTINCT trend style per variant so the photos shown
    // look genuinely different from each other, matching XHS's current
    // viral look, instead of Claude's own style pick (which tended to
    // converge on similar moods across the 3 options).
    const trendStyles = pickRandomTrendStyles(plans.length);

    const variants = await Promise.all(
      plans.map((plan, i) =>
        applyBrandStyle(inputBuffer, {
          trendStyle: trendStyles[i],
          brandColorHex,
          hookText: plan.hookText,
          logoBuffer,
          logoPosition: plan.logoPosition,
          textPosition: plan.textPosition,
        }),
      ),
    );

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
