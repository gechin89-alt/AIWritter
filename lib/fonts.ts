import path from "node:path";
import { GlobalFonts } from "@napi-rs/canvas";

// Bundled instead of relying on system fonts: Windows dev and Netlify's
// Linux serverless functions don't have the same fonts installed, so a
// font-family name that renders fine locally can silently fall back to a
// generic (or tofu/no-CJK) font in production. @napi-rs/canvas's
// GlobalFonts.registerFromPath() loads the actual file directly, unlike
// SVG's @font-face (which librsvg silently ignores — confirmed by testing:
// a real @font-face rule and a made-up nonexistent font name produced
// pixel-identical output), so this is the reliable way to get the same
// look everywhere.
export type CaptionFont = "bold" | "script" | "playful";

const FONT_FILES: Record<CaptionFont, string> = {
  bold: "ZCOOLQingKeHuangYou-Regular.ttf",
  script: "MaShanZheng-Regular.ttf",
  playful: "ZCOOLKuaiLe-Regular.ttf",
};

const FAMILY_NAMES: Record<CaptionFont, string> = {
  bold: "XhsCaptionBold",
  script: "XhsCaptionScript",
  playful: "XhsCaptionPlayful",
};

const registered = new Set<CaptionFont>();

export function getCaptionFontFamily(font: CaptionFont): string {
  if (!registered.has(font)) {
    const filePath = path.join(process.cwd(), "assets", "fonts", FONT_FILES[font]);
    GlobalFonts.registerFromPath(filePath, FAMILY_NAMES[font]);
    registered.add(font);
  }
  return FAMILY_NAMES[font];
}
