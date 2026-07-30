import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { applyBrandStyle, pickRandomTrendStyles, COVER_STYLE_TO_TREND_STYLE, type TrendStyle } from "@/lib/image-filter";
import {
  analyzePhotoForStyling,
  COVER_STYLE_NAMES,
  type PhotoStylingPlan,
  type TextMode,
} from "@/lib/anthropic";
import { readImageAsBase64 } from "@/lib/media";
import { fetchAsBuffer } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  const {
    mediaPath,
    campaignSlug,
    locale,
    textMode: rawTextMode,
    customText,
    forcePreview,
  }: {
    mediaPath?: string;
    campaignSlug?: string;
    locale?: "en" | "zh";
    textMode?: TextMode;
    customText?: string;
    /** Admin's quick photo-effect test button — always show the full AI
     * styling even if this campaign hasn't had a brand color/logo set yet,
     * since the whole point is previewing the effect before committing to
     * a look. Never set by the real customer-facing flow. */
    forcePreview?: boolean;
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
    // campaigns nobody configured a look for. forcePreview (admin's test
    // button only) bypasses this so the effect can be previewed up front.
    if (!campaign.brandColor && !campaign.logoPath && !forcePreview) {
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

    let trendStyles: TrendStyle[];
    if (textMode === "auto") {
      // Each "auto" plan carries Claude's own reasoned coverStyleId (which
      // of the 10 XHS_Viral_Cover_Catalogue.md archetypes fits this photo) —
      // map that to its rendering recipe instead of assigning at random.
      // Anything missing a valid id (shouldn't normally happen) falls back
      // to a random, not-yet-used style so it still looks distinct.
      const used = new Set<TrendStyle>();
      let fallbackPool: TrendStyle[] | null = null;
      trendStyles = plans.map((plan) => {
        const mapped = plan.coverStyleId ? COVER_STYLE_TO_TREND_STYLE[plan.coverStyleId] : undefined;
        if (mapped && !used.has(mapped)) {
          used.add(mapped);
          return mapped;
        }
        if (!fallbackPool) fallbackPool = pickRandomTrendStyles(plans.length);
        const fallback = fallbackPool.find((s) => !used.has(s)) ?? fallbackPool[0];
        used.add(fallback);
        return fallback;
      });
    } else {
      // Randomly assign a DISTINCT trend style per variant so the photos
      // shown look genuinely different from each other — no coverStyleId
      // exists here since the text itself doesn't vary in these modes.
      trendStyles = pickRandomTrendStyles(plans.length);
    }

    const variants = await Promise.all(
      plans.map((plan, i) =>
        applyBrandStyle(inputBuffer, {
          trendStyle: trendStyles[i],
          brandColorHex,
          hookText: plan.hookText,
          subtitle: plan.subtitle,
          logoBuffer,
          logoPosition: plan.logoPosition,
          textPosition: plan.textPosition,
          coverStyleId: plan.coverStyleId,
        }),
      ),
    );

    if (variants.length === 0) {
      return NextResponse.json({ path: mediaPath, variants: [], filtered: false });
    }

    // Transient UI metadata for the picker screen only — not persisted with
    // the submission, so a customer can see WHY each option was suggested
    // without us needing to store/replay it later.
    const variantMeta =
      textMode === "auto"
        ? plans.map((plan) => ({
            coverStyleName: plan.coverStyleId
              ? COVER_STYLE_NAMES[plan.coverStyleId]?.[locale === "en" ? "en" : "zh"]
              : undefined,
            coverStyleReason: plan.coverStyleReason,
          }))
        : undefined;

    return NextResponse.json({ path: variants[0], variants, variantMeta, filtered: true });
  } catch {
    // analyzePhotoForStyling already degrades to offline template styling
    // on AiUnavailableError internally, so reaching here means something
    // else went wrong (e.g. sharp/Cloudinary) — the customer still gets
    // their unstyled photo rather than a hard failure.
    return NextResponse.json({ path: mediaPath, variants: [], filtered: false });
  }
}
