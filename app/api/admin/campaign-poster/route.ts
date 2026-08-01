import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePosterCopy } from "@/lib/anthropic";
import { applyPosterStyle } from "@/lib/image-filter";
import { fetchAsBuffer } from "@/lib/cloudinary";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return null;
  }
  return session;
}

// Standalone campaign/event promo poster — admin-generated once per
// campaign, distinct from the per-customer cover-style photo system.
// Two calls: omit title/subtitle to have Claude draft copy from the
// campaign's own context + an optional brief; pass title/subtitle (and
// optionally tagline) directly to skip straight to rendering with
// admin-edited text.
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    campaignId,
    mediaPath,
    briefText,
    locale,
    title,
    subtitle,
    tagline,
  }: {
    campaignId?: string;
    // Optional — omit to only draft/redraft the copy (e.g. before a photo
    // has been picked yet); provide it to actually render the poster.
    mediaPath?: string;
    briefText?: string;
    locale?: "en" | "zh";
    title?: string;
    subtitle?: string;
    tagline?: string;
  } = await req.json();

  if (!campaignId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true, productDescription: true, brandColor: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  try {
    let copy: { title: string; subtitle: string; tagline: string };
    if (title && subtitle) {
      copy = { title, subtitle, tagline: tagline ?? "" };
    } else {
      copy = await generatePosterCopy({
        brandName: campaign.name,
        productDescription: campaign.productDescription ?? undefined,
        briefText,
        locale,
      });
    }

    if (!mediaPath) {
      // Copy-drafted-only request (no photo picked yet) - nothing to render.
      return NextResponse.json({ posterUrl: null, ...copy });
    }

    const inputBuffer = await fetchAsBuffer(mediaPath);
    const posterUrl = await applyPosterStyle(inputBuffer, {
      title: copy.title,
      subtitle: copy.subtitle,
      tagline: copy.tagline,
      brandColorHex: campaign.brandColor,
    });

    return NextResponse.json({ posterUrl, ...copy });
  } catch {
    return NextResponse.json({ error: "Poster generation failed" }, { status: 500 });
  }
}
