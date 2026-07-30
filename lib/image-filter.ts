import sharp from "sharp";
import { createCanvas } from "@napi-rs/canvas";
import type { LogoPosition, TextPosition } from "./anthropic";
import { uploadBufferToCloudinary } from "./cloudinary";
import { getCaptionFontFamily, type CaptionFont } from "./fonts";

/**
 * Free alternative to Cloudinary's paid background-removal add-on: fades
 * near-white pixels to transparent (soft threshold for smooth edges rather
 * than a hard cutoff). Works well for the common "logo on a flat white
 * background" case; won't handle non-white or complex backgrounds — that
 * would need real AI segmentation (a paid API).
 */
export async function removeWhiteBackground(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const lower = 200;
  const upper = 250;
  for (let i = 0; i < data.length; i += channels) {
    const minC = Math.min(data[i], data[i + 1], data[i + 2]);
    if (minC >= lower) {
      const t = Math.min(1, (minC - lower) / (upper - lower));
      data[i + 3] = Math.round(data[i + 3] * (1 - t));
    }
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

/**
 * Crops to XHS's preferred 3:4 (portrait) feed ratio using smart "attention"
 * cropping (keeps the most visually interesting region) rather than a naive
 * center crop. Never upscales — the crop box is derived directly from the
 * source image's own resolution.
 */
async function cropTo3by4(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const origW = meta.width ?? 800;
  const origH = meta.height ?? 800;
  const targetRatio = 3 / 4;

  let targetW: number;
  let targetH: number;
  if (origW / origH > targetRatio) {
    targetH = origH;
    targetW = Math.round(origH * targetRatio);
  } else {
    targetW = origW;
    targetH = Math.round(origW / targetRatio);
  }

  return sharp(buffer)
    .resize(targetW, targetH, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 92 })
    .toBuffer();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

type HueBucket = "neutral" | "red" | "warm" | "green" | "cyan" | "blue" | "purple";

function classifyHue(h: number, s: number): HueBucket {
  if (s < 0.14) return "neutral";
  if (h < 20 || h >= 335) return "red";
  if (h < 70) return "warm"; // orange/yellow
  if (h < 170) return "green";
  if (h < 200) return "cyan";
  if (h < 260) return "blue";
  return "purple";
}

// Font-color pairing derived from a designer color-pairing reference the
// client shared (white/light bg -> a darker, often hue-matched ink; the
// suited dark ink hue varies by background hue; black/dark bg -> near-
// universally white/light regardless of hue, so unlike the light case we
// don't need a per-hue table there).
const LIGHT_BG_INK: Record<HueBucket, string> = {
  neutral: "rgba(26, 26, 26, 0.92)",
  red: "rgba(58, 37, 48, 0.92)", // dark purple/coffee, per "浅色背景+纯白或深紫/褐色"
  warm: "rgba(33, 26, 16, 0.92)", // "淡黄底黑字最不容易发生色散"
  green: "rgba(255, 255, 255, 0.92)", // "绿色背景配纯白/橘黄/浅黄效果最好"
  cyan: "rgba(18, 51, 48, 0.92)",
  blue: "rgba(22, 35, 63, 0.92)", // "浅蓝背景配深蓝文字"
  purple: "rgba(26, 26, 26, 0.92)",
};

/**
 * Samples the average pixel color of a region of the ALREADY-GRADED photo
 * (post color-grade, pre text overlay) so caption ink can be matched to what
 * is actually behind the text — not just the trend style's abstract mood
 * color. A trend style's overall mood can be "bright" while the specific
 * strip the text lands on is dark (e.g. dark clothing/floor in the frame),
 * which a whole-photo or gradient-only proxy misses entirely.
 */
async function sampleRegionColor(
  buffer: Buffer,
  region: { left: number; top: number; width: number; height: number },
): Promise<{ r: number; g: number; b: number }> {
  const meta = await sharp(buffer).metadata();
  const imgW = meta.width ?? region.left + region.width;
  const imgH = meta.height ?? region.top + region.height;
  const left = Math.max(0, Math.min(Math.round(region.left), imgW - 1));
  const top = Math.max(0, Math.min(Math.round(region.top), imgH - 1));
  const width = Math.max(1, Math.min(Math.round(region.width), imgW - left));
  const height = Math.max(1, Math.min(Math.round(region.height), imgH - top));
  const { data } = await sharp(buffer)
    .extract({ left, top, width, height })
    .resize(1, 1)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2] };
}

/**
 * Picks a legible caption ink color (+ matching shadow) for a solid-fill
 * text treatment (paragraph/vertical), based on the actual photo pixels
 * behind where the text will sit (see sampleRegionColor) rather than always
 * defaulting to plain white — a fixed white (or a whole-photo-mood-based)
 * fill can land dark-on-dark against a specific busy region of the photo.
 */
function pickCaptionInk(bg: { r: number; g: number; b: number }): { fill: string; shadow: string } {
  const { h, s, l } = rgbToHsl(bg.r, bg.g, bg.b);

  if (l < 0.4) {
    // Dark background: white/light-warm text is near-universally the right
    // call regardless of hue — blue/dark-red/purple text on a dark
    // background is explicitly called out as illegible.
    return { fill: "rgba(255, 255, 255, 0.92)", shadow: "rgba(0, 0, 0, 0.55)" };
  }
  const bucket = classifyHue(h, s);
  const fill = LIGHT_BG_INK[bucket];
  // Every bucket here is a dark ink except "green" (white text reads better
  // on a green background per the reference) — a light-fill needs a dark
  // shadow for edge definition, the opposite of the dark-ink buckets.
  const shadow = bucket === "green" ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.6)";
  return { fill, shadow };
}

// Height reserved for the caption overlay — shared with callers so they can
// work out where to composite it (e.g. vertically centering a "middle"
// placement) without duplicating the formula. A headline+subtitle pair
// needs more vertical room than a single line.
export function getCaptionAreaHeight(height: number, hasSubtitle = false): number {
  return Math.round(height * (hasSubtitle ? 0.3 : 0.22));
}

const LINE_BREAK_CHARS = new Set([" ", ",", "，", "、", "！", "!", "？", "?", "。", "-", "·"]);

// No natural word boundaries in Chinese, so this looks for a break character
// nearest the middle first, falling back to a straight midpoint split.
function splitIntoTwoLines(text: string): [string, string] {
  const mid = Math.floor(text.length / 2);
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 1; i < text.length - 1; i++) {
    if (LINE_BREAK_CHARS.has(text[i])) {
      const dist = Math.abs(i - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
  }
  const cut = bestIdx === -1 ? mid : text[bestIdx] === " " ? bestIdx : bestIdx + 1;
  return [text.slice(0, cut).trim(), text.slice(cut).trim()];
}

export type TextTreatment =
  | { kind: "headline"; chip: boolean; align: "left" | "center" }
  | { kind: "paragraph"; align: "left" | "center" }
  | { kind: "vertical"; side: "left" | "right" };

/**
 * Which of the 10 XHS_Viral_Cover_Catalogue.md cover styles get a solid
 * poster-style color block behind the text ("大字报") vs. text floating
 * directly on the photo, vs. a quiet multi-line diary-style paragraph in a
 * brush-script font, vs. a single short phrase set vertically along one
 * edge (the quiet "一个人的下午茶"-style caption), and left vs. center
 * alignment — without this, the 3 shown variants only differed by color
 * grade, which read as "basically the same" (block-style, diary-caption and
 * vertical-caption covers are among the catalogue's own archetypes, not just
 * a color choice). See COVER_STYLE_NAMES in lib/anthropic.ts for what each
 * id is.
 */
export const COVER_STYLE_TEXT_TREATMENT: Record<number, TextTreatment> = {
  1: { kind: "headline", chip: false, align: "left" }, // Real-Person Direct Shot
  2: { kind: "headline", chip: true, align: "center" }, // Before/After Transformation
  3: { kind: "headline", chip: true, align: "left" }, // Bold Headline / Color Block
  4: { kind: "vertical", side: "left" }, // Pain Point + Contrast Portrait
  5: { kind: "paragraph", align: "left" }, // Confessional / Story Hook
  6: { kind: "headline", chip: true, align: "center" }, // Reveal-Half Suspense Hook
  7: { kind: "headline", chip: false, align: "center" }, // Two-Person Interactive Frame
  8: { kind: "headline", chip: true, align: "center" }, // Cross-Category Mashup
  9: { kind: "paragraph", align: "left" }, // Real-Life / Lived-In Scene
  10: { kind: "vertical", side: "right" }, // Minimalist Infographic
};

const DEFAULT_TEXT_TREATMENT = { kind: "headline", chip: false, align: "center" } as const;

/**
 * A short 2-4 line reflective/diary-style caption in a delicate brush-
 * script font (MaShanZheng, already bundled as the "script" caption font) —
 * small, quiet, and left-aligned by default, sitting in open space rather
 * than dominating the frame, unlike the bold headline treatment. Height is
 * driven by however many lines the caption actually has, not the fixed
 * getCaptionAreaHeight band.
 *
 * Ink color is resolved by the caller (via sampleRegionColor + pickCaptionInk
 * against the actual photo pixels behind this text) rather than always being
 * plain white, which washed out on lighter/warmer photo regions.
 */
function paragraphLines(paragraph: string): string[] {
  return paragraph
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function paragraphAreaHeight(lineCount: number, width: number): number {
  const fontSize = Math.round(width * 0.052);
  const lineHeight = fontSize * 1.55;
  return Math.round(lineHeight * lineCount + fontSize * 1.1);
}

async function renderParagraphOverlay(
  paragraph: string,
  width: number,
  align: "left" | "center",
  ink: { fill: string; shadow: string },
): Promise<{ buffer: Buffer; areaHeight: number }> {
  const family = getCaptionFontFamily("script");
  const lines = paragraphLines(paragraph);
  const fontSize = Math.round(width * 0.052);
  const lineHeight = fontSize * 1.55;
  const areaHeight = paragraphAreaHeight(lines.length, width);

  const canvas = createCanvas(width, areaHeight);
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "middle";
  ctx.textAlign = align === "left" ? "left" : "center";
  ctx.font = `${fontSize}px "${family}"`;

  const marginX = width * 0.09;
  const anchorX = align === "left" ? marginX : width / 2;
  const startY = areaHeight / 2 - (lineHeight * (lines.length - 1)) / 2;

  const { fill: fillColor, shadow: shadowColor } = ink;

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = fillColor;
    ctx.fillText(lines[i], anchorX, y);
  }

  return { buffer: canvas.toBuffer("image/png"), areaHeight };
}

/**
 * A single short phrase set vertically (one character per line, top to
 * bottom) along one edge of the photo — the quiet "一个人的下午茶"-style
 * caption, distinct from both the bold headline and the multi-line diary
 * paragraph. Reuses hookText (already a short single line) rather than
 * needing a dedicated AI-authored field.
 */
function verticalAreaWidth(height: number): number {
  const fontSize = Math.round(height * 0.032);
  return Math.round(fontSize * 2.4);
}

async function renderVerticalOverlay(
  text: string,
  height: number,
  side: "left" | "right",
  ink: { fill: string; shadow: string },
): Promise<{ buffer: Buffer; areaWidth: number }> {
  const family = getCaptionFontFamily("script");
  const chars = Array.from(text.trim()).slice(0, 12);
  const fontSize = Math.round(height * 0.032);
  const charSpacing = fontSize * 1.35;
  const areaWidth = verticalAreaWidth(height);
  const totalTextHeight = charSpacing * chars.length;

  const canvas = createCanvas(areaWidth, height);
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `${fontSize}px "${family}"`;

  const { fill: fillColor, shadow: shadowColor } = ink;

  const anchorX = areaWidth / 2;
  const startY = height / 2 - totalTextHeight / 2 + charSpacing / 2;

  for (let i = 0; i < chars.length; i++) {
    const y = startY + i * charSpacing;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = fillColor;
    ctx.fillText(chars[i], anchorX, y);
  }

  return { buffer: canvas.toBuffer("image/png"), areaWidth };
}

/**
 * Two looks depending on treatment.chip:
 * - No chip: text sits directly on the photo — gradient fill, contrast
 *   outline, soft drop shadow for legibility on an unpredictable background.
 * - Chip: a solid poster-style color block behind the text (real flat
 *   color, not the gradient), with plain high-contrast text on top instead
 *   of an outline — reads as a genuinely different composition, not just a
 *   different color grade of the same floating-text layout.
 * Wraps to a second line (shrinking to fit) if the headline is too wide for
 * one line. When a subtitle is given, renders it as a smaller supporting
 * line below the headline — matching real XHS "大字报" covers, which pair a
 * bold short hook with a softer second line rather than one flat line.
 * Returns a transparent PNG overlay sized to getCaptionAreaHeight(height).
 */
type HeadlineTreatment = Extract<TextTreatment, { kind: "headline" }>;

async function renderCaptionOverlay(
  text: string,
  width: number,
  height: number,
  gradientColors: [string, string],
  captionFont: CaptionFont,
  subtitle?: string,
  treatment: HeadlineTreatment = DEFAULT_TEXT_TREATMENT,
): Promise<Buffer> {
  const hasSubtitle = Boolean(subtitle?.trim());
  const areaHeight = getCaptionAreaHeight(height, hasSubtitle);
  const baseFontSize = Math.round(areaHeight * (hasSubtitle ? 0.34 : 0.3));
  const family = getCaptionFontFamily(captionFont);

  const canvas = createCanvas(width, areaHeight);
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "middle";
  ctx.textAlign = treatment.align === "left" ? "left" : "center";

  const marginX = width * 0.08;
  const anchorX = treatment.align === "left" ? marginX : width / 2;

  const maxLineWidth = width * (treatment.align === "left" ? 0.78 : 0.86);
  ctx.font = `${baseFontSize}px "${family}"`;
  const fitsOneLine = ctx.measureText(text).width <= maxLineWidth;

  const lines = fitsOneLine ? [text] : splitIntoTwoLines(text);
  const fontSize = fitsOneLine ? baseFontSize : Math.round(baseFontSize * 0.74);

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, gradientColors[0]);
  gradient.addColorStop(1, gradientColors[1]);

  // The text needs to stay legible against whatever the underlying photo
  // looks like, not just the gradient itself — a solid outline (color
  // picked opposite the gradient's own brightness) does that far more
  // reliably than a soft drop shadow alone, matching how real viral covers
  // guarantee text pops on any background.
  const avgLuminance = (relativeLuminance(gradientColors[0]) + relativeLuminance(gradientColors[1])) / 2;
  const outlineColor = avgLuminance > 0.55 ? "rgba(20, 20, 20, 0.9)" : "rgba(255, 255, 255, 0.9)";
  // The subtitle is always white-on-dark-outline regardless of the
  // headline's own gradient tone — unlike the headline, it doesn't get to
  // pick its position for a favorable background, so it needs the single
  // most universally legible combo rather than one that matches the
  // headline's mood but can land dark-on-dark against a busy photo.
  const subtitleFillColor = "rgba(255, 255, 255, 0.95)";
  const subtitleOutlineColor = "rgba(20, 20, 20, 0.85)";
  const lineHeight = fontSize * 1.25;
  const subtitleFontSize = Math.round(fontSize * 0.42);
  const subtitleGap = Math.round(fontSize * 0.32);
  const headlineBlockHeight = lineHeight * lines.length;
  const totalBlockHeight = headlineBlockHeight + (hasSubtitle ? subtitleGap + subtitleFontSize : 0);
  const startY = areaHeight / 2 - totalBlockHeight / 2 + lineHeight / 2;

  let onChipTextColor = "rgba(255, 255, 255, 0.95)";
  if (treatment.chip) {
    ctx.font = `${fontSize}px "${family}"`;
    let maxTextWidth = 0;
    for (const line of lines) maxTextWidth = Math.max(maxTextWidth, ctx.measureText(line).width);
    if (hasSubtitle) {
      ctx.font = `${subtitleFontSize}px "${family}"`;
      maxTextWidth = Math.max(maxTextWidth, ctx.measureText(subtitle!.trim()).width);
    }
    const padX = fontSize * 0.5;
    const padY = fontSize * 0.35;
    const chipW = Math.min(width * 0.94, maxTextWidth + padX * 2);
    const chipH = totalBlockHeight + padY * 2;
    const chipX = treatment.align === "left" ? Math.max(width * 0.03, marginX - padX) : width / 2 - chipW / 2;
    const chipY = areaHeight / 2 - chipH / 2;
    const chipRgb = hexToRgb(gradientColors[0]) ?? { r: 20, g: 20, b: 20 };
    const chipLuminance = (0.299 * chipRgb.r + 0.587 * chipRgb.g + 0.114 * chipRgb.b) / 255;
    onChipTextColor = chipLuminance > 0.6 ? "rgba(20, 20, 20, 0.95)" : "rgba(255, 255, 255, 0.95)";

    ctx.fillStyle = `rgba(${chipRgb.r}, ${chipRgb.g}, ${chipRgb.b}, 0.9)`;
    const radius = Math.round(fontSize * 0.16);
    ctx.beginPath();
    ctx.moveTo(chipX + radius, chipY);
    ctx.arcTo(chipX + chipW, chipY, chipX + chipW, chipY + chipH, radius);
    ctx.arcTo(chipX + chipW, chipY + chipH, chipX, chipY + chipH, radius);
    ctx.arcTo(chipX, chipY + chipH, chipX, chipY, radius);
    ctx.arcTo(chipX, chipY, chipX + chipW, chipY, radius);
    ctx.closePath();
    ctx.fill();
  }

  ctx.font = `${fontSize}px "${family}"`;
  const lineWidth = Math.max(2, Math.round(fontSize * 0.09));
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;

    if (treatment.chip) {
      // Flat color block behind us already provides the contrast — an
      // outline here would just look muddy against a color we picked
      // ourselves, so plain high-contrast text is cleaner.
      ctx.shadowColor = "transparent";
      ctx.fillStyle = onChipTextColor;
      ctx.fillText(lines[i], anchorX, y);
      continue;
    }

    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.strokeStyle = outlineColor;
    ctx.strokeText(lines[i], anchorX, y);

    // Fill goes on top without its own shadow — the stroke pass above
    // already provided the depth/contrast.
    ctx.shadowColor = "transparent";
    ctx.fillStyle = gradient;
    ctx.fillText(lines[i], anchorX, y);
  }

  if (hasSubtitle) {
    const y = startY + (lines.length - 1) * lineHeight + lineHeight / 2 + subtitleGap + subtitleFontSize / 2;
    ctx.font = `${subtitleFontSize}px "${family}"`;

    if (treatment.chip) {
      ctx.shadowColor = "transparent";
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = onChipTextColor;
      ctx.fillText(subtitle!.trim(), anchorX, y);
      ctx.globalAlpha = 1;
      return canvas.toBuffer("image/png");
    }

    const subtitleLineWidth = Math.max(1.5, Math.round(subtitleFontSize * 0.09));
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.lineWidth = subtitleLineWidth;
    ctx.lineJoin = "round";
    ctx.strokeStyle = subtitleOutlineColor;
    ctx.strokeText(subtitle!.trim(), anchorX, y);

    ctx.shadowColor = "transparent";
    ctx.fillStyle = subtitleFillColor;
    ctx.fillText(subtitle!.trim(), anchorX, y);
  }

  return canvas.toBuffer("image/png");
}

async function applyVignetteOverlay(buffer: Buffer, width: number, height: number): Promise<Buffer> {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="v" cx="50%" cy="50%" r="72%">
        <stop offset="55%" stop-color="black" stop-opacity="0" />
        <stop offset="100%" stop-color="black" stop-opacity="0.55" />
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#v)" />
  </svg>`;
  const vignetteBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(buffer).composite([{ input: vignetteBuffer, blend: "multiply" }]).jpeg({ quality: 92 }).toBuffer();
}

async function applyGrainOverlay(buffer: Buffer, width: number, height: number, amount: number): Promise<Buffer> {
  const intensity = Math.round(amount * 260);
  const noiseSize = Math.max(200, Math.min(500, Math.round(Math.min(width, height) * 0.35)));
  const noiseData = Buffer.alloc(noiseSize * noiseSize * 3);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = Math.max(0, Math.min(255, 128 + Math.round((Math.random() - 0.5) * 2 * intensity)));
  }
  const noise = await sharp(noiseData, { raw: { width: noiseSize, height: noiseSize, channels: 3 } })
    .resize(width, height)
    .jpeg({ quality: 90 })
    .toBuffer();
  return sharp(buffer).composite([{ input: noise, blend: "overlay" }]).jpeg({ quality: 92 }).toBuffer();
}

async function applyGlowOverlay(buffer: Buffer, width: number, height: number, opacity: number): Promise<Buffer> {
  const blurRadius = Math.max(8, Math.round(Math.min(width, height) * 0.02));
  const blurred = await sharp(buffer).blur(blurRadius).ensureAlpha(opacity).png().toBuffer();
  return sharp(buffer).composite([{ input: blurred, blend: "screen" }]).jpeg({ quality: 92 }).toBuffer();
}

type ColorOverlay = { color: string; blend: "soft-light" | "multiply" | "overlay" | "screen"; opacity: number };

export type TrendStyle =
  | "goldenHour"
  | "kodakPortra"
  | "cinematic"
  | "dreamySoft"
  | "quietLuxury"
  | "vintageFilm"
  | "earthTone"
  | "brightClean"
  | "tiktokViral"
  | "mochaBrown"
  | "creamyBeige"
  | "forestGreen";

type TrendConfig = {
  brightness?: number;
  saturation?: number;
  linear?: { a: number; b: number };
  overlays?: ColorOverlay[];
  grain?: number;
  glow?: number;
  vignette?: boolean;
  captionGradient: [string, string];
  // Which bundled caption font matches this style's mood: "bold" (thick,
  // punchy — 2026 XHS covers lean heavily on bold/tiered text), "script"
  // (soft handwritten/brush look, trending for lifestyle/quiet-luxury
  // covers), or "playful" (rounded, casual/cute).
  fontKey: CaptionFont;
};

const TREND_STYLES: Record<TrendStyle, TrendConfig> = {
  goldenHour: {
    brightness: 1.08,
    saturation: 1.15,
    overlays: [{ color: "#ffb347", blend: "soft-light", opacity: 0.28 }],
    glow: 0.18,
    captionGradient: ["#ffd166", "#ff7a3d"],
    fontKey: "bold",
  },
  kodakPortra: {
    brightness: 1.03,
    saturation: 0.9,
    linear: { a: 0.92, b: 15 },
    overlays: [{ color: "#ffdca8", blend: "soft-light", opacity: 0.12 }],
    grain: 0.07,
    captionGradient: ["#f6c99a", "#e8896b"],
    fontKey: "playful",
  },
  cinematic: {
    linear: { a: 1.15, b: -15 },
    overlays: [
      { color: "#ff8a3d", blend: "soft-light", opacity: 0.18 },
      { color: "#1b4b5a", blend: "multiply", opacity: 0.14 },
    ],
    vignette: true,
    captionGradient: ["#ff8a3d", "#2c5364"],
    fontKey: "bold",
  },
  dreamySoft: {
    brightness: 1.12,
    saturation: 0.78,
    overlays: [{ color: "#f5c6e0", blend: "soft-light", opacity: 0.1 }],
    glow: 0.28,
    captionGradient: ["#f6c6e0", "#c9b6f2"],
    fontKey: "script",
  },
  quietLuxury: {
    brightness: 1.02,
    saturation: 0.72,
    linear: { a: 0.95, b: 8 },
    overlays: [{ color: "#e9dcc9", blend: "soft-light", opacity: 0.1 }],
    captionGradient: ["#d8c8ab", "#a68f6b"],
    fontKey: "script",
  },
  vintageFilm: {
    linear: { a: 0.88, b: 20 },
    overlays: [{ color: "#d98a3d", blend: "soft-light", opacity: 0.18 }],
    grain: 0.13,
    vignette: true,
    captionGradient: ["#e0a458", "#8a5a2c"],
    fontKey: "script",
  },
  earthTone: {
    brightness: 1.02,
    saturation: 0.82,
    overlays: [{ color: "#8a7654", blend: "soft-light", opacity: 0.22 }],
    captionGradient: ["#a68f6b", "#6b7a4f"],
    fontKey: "playful",
  },
  brightClean: {
    brightness: 1.15,
    saturation: 1.05,
    linear: { a: 1.05, b: -5 },
    overlays: [{ color: "#ffd9e6", blend: "soft-light", opacity: 0.08 }],
    captionGradient: ["#ff9fc0", "#ffd166"],
    fontKey: "bold",
  },
  tiktokViral: {
    brightness: 1.1,
    saturation: 1.35,
    linear: { a: 1.1, b: -8 },
    overlays: [{ color: "#ff5c8a", blend: "soft-light", opacity: 0.16 }],
    captionGradient: ["#ff5c8a", "#ffd166"],
    fontKey: "bold",
  },
  mochaBrown: {
    brightness: 0.95,
    saturation: 0.75,
    linear: { a: 1.08, b: -10 },
    overlays: [{ color: "#4a2c17", blend: "multiply", opacity: 0.22 }],
    captionGradient: ["#c9a578", "#6b4423"],
    fontKey: "script",
  },
  creamyBeige: {
    brightness: 1.12,
    saturation: 0.68,
    linear: { a: 0.96, b: 10 },
    overlays: [{ color: "#f3e5d0", blend: "soft-light", opacity: 0.22 }],
    captionGradient: ["#f3e5d0", "#d9c2a0"],
    fontKey: "playful",
  },
  forestGreen: {
    brightness: 0.92,
    saturation: 0.85,
    linear: { a: 1.1, b: -10 },
    overlays: [{ color: "#1f3d2b", blend: "multiply", opacity: 0.22 }],
    vignette: true,
    captionGradient: ["#4a7a5c", "#1f3d2b"],
    fontKey: "playful",
  },
};

/**
 * Randomly assigns `count` DISTINCT trend styles from the full curated set —
 * used so the several photo variants shown to a customer are guaranteed to
 * look genuinely different from each other, rather than hoping the AI
 * naturally avoids picking similar moods. Still used for "custom"/"none"
 * text modes, which only produce one shared styling plan (no coverStyleId
 * to map from) — see COVER_STYLE_TO_TREND_STYLE for "auto" mode.
 */
export function pickRandomTrendStyles(count: number): TrendStyle[] {
  const keys = Object.keys(TREND_STYLES) as TrendStyle[];
  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Maps each of the 10 XHS_Viral_Cover_Catalogue.md composition archetypes
 * (see COVER_STYLE_NAMES in lib/anthropic.ts — Claude picks WHICH of these
 * fits a given photo) to whichever of the 12 rendering trend styles above
 * best matches that archetype's mood, so "auto" mode's 3 variants are
 * styled from Claude's own reasoned picks instead of a random assignment.
 * Curated by hand; 2 trend styles (dreamySoft's near-duplicate use aside,
 * brightClean already used) are intentionally left unmapped here and still
 * only reachable via the random assignment on other text modes.
 */
export const COVER_STYLE_TO_TREND_STYLE: Record<number, TrendStyle> = {
  1: "goldenHour", // Real-Person Direct Shot — warm, soft, natural
  2: "brightClean", // Before/After Transformation — crisp clarity to show the difference
  3: "tiktokViral", // Bold Headline / Color Block — high saturation, punchy
  4: "kodakPortra", // Pain Point + Contrast Portrait — natural, trustworthy
  5: "creamyBeige", // Confessional / Story Hook — warm, lived-in
  6: "cinematic", // Reveal-Half Suspense Hook — moody, shadowed
  7: "dreamySoft", // Two-Person Interactive Frame — soft social warmth
  8: "mochaBrown", // Cross-Category Mashup — distinct, unexpected mood
  9: "earthTone", // Real-Life / Lived-In Scene — natural, unstaged
  10: "quietLuxury", // Minimalist Infographic — clean, understated
};

/**
 * Temporary test-only helper: applies a curated trend-style color grade
 * (2026's popular looks — golden hour, film grain, cinematic teal-orange,
 * soft glow, quiet luxury, vintage film, earth tone, bright clean), an
 * optional polaroid frame, and an optional caption — no AI call, so it's
 * free to run repeatedly while exploring looks.
 */
export async function applyBeautifyOnly(
  inputBuffer: Buffer,
  options: {
    trendStyle?: TrendStyle;
    captionText?: string;
    polaroid?: boolean;
  } = {},
): Promise<string> {
  const styleKey = options.trendStyle ?? "goldenHour";
  const cfg = TREND_STYLES[styleKey];

  let image = sharp(inputBuffer)
    .rotate()
    .modulate({ brightness: cfg.brightness ?? 1, saturation: cfg.saturation ?? 1 });
  if (cfg.linear) {
    image = image.linear(cfg.linear.a, cfg.linear.b);
  }
  let buffer = await image.jpeg({ quality: 92 }).toBuffer();
  buffer = await cropTo3by4(buffer);
  let { width = 800, height = 800 } = await sharp(buffer).metadata();

  for (const overlay of cfg.overlays ?? []) {
    const rgb = hexToRgb(overlay.color)!;
    const layer = await sharp({
      create: { width, height, channels: 4, background: { ...rgb, alpha: overlay.opacity } },
    })
      .png()
      .toBuffer();
    buffer = await sharp(buffer)
      .composite([{ input: layer, blend: overlay.blend }])
      .jpeg({ quality: 92 })
      .toBuffer();
  }

  if (cfg.grain) {
    buffer = await applyGrainOverlay(buffer, width, height, cfg.grain);
  }
  if (cfg.glow) {
    buffer = await applyGlowOverlay(buffer, width, height, cfg.glow);
  }
  if (cfg.vignette) {
    buffer = await applyVignetteOverlay(buffer, width, height);
  }

  if (options.polaroid) {
    const border = Math.round(width * 0.04);
    const bottomBorder = Math.round(height * 0.18);
    buffer = await sharp(buffer)
      .extend({ top: border, bottom: bottomBorder, left: border, right: border, background: "#ffffff" })
      .jpeg({ quality: 92 })
      .toBuffer();
    const meta = await sharp(buffer).metadata();
    width = meta.width ?? width + border * 2;
    height = meta.height ?? height + border + bottomBorder;
  }

  const captionText = options.captionText?.trim();
  if (captionText) {
    if (options.polaroid) {
      const stripHeight = Math.round(height * 0.14);
      const fontSize = Math.round(stripHeight * 0.38);
      const svg = `<svg width="${width}" height="${stripHeight}" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="50%" font-size="${fontSize}" font-family="Segoe UI Emoji, Microsoft YaHei, PingFang SC, SimHei, Arial, sans-serif"
          fill="#1c1c1c" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${escapeXml(
            captionText,
          )}</text>
      </svg>`;
      const captionBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
      buffer = await sharp(buffer)
        .composite([{ input: captionBuffer, left: 0, top: height - stripHeight }])
        .jpeg({ quality: 92 })
        .toBuffer();
    } else {
      const overlayBuffer = await renderCaptionOverlay(captionText, width, height, cfg.captionGradient, cfg.fontKey);
      // XHS feed thumbnails get their top ~15% covered by the app's own UI
      // chrome, so real viral covers leave that strip blank and place text
      // in the upper-center third instead of flush against the top edge.
      buffer = await sharp(buffer)
        .composite([{ input: overlayBuffer, left: 0, top: Math.round(height * 0.13) }])
        .jpeg({ quality: 92 })
        .toBuffer();
    }
  }

  return uploadBufferToCloudinary(buffer);
}

/**
 * Applies AI-directed brand styling to an uploaded photo: a random pick from
 * the curated 12-style trend set (so the several variants shown to a
 * customer are genuinely distinct from each other, matching XHS's current
 * viral look rather than one flat brand filter), a subtle brand-color wash
 * layered on top so brand identity still comes through, a scroll-stopping
 * hook-text caption (gradient-filled, drop-shadowed, sitting directly on the
 * photo), and an optional logo watermark placed wherever Claude judged the
 * photo has open background.
 */
export async function applyBrandStyle(
  inputBuffer: Buffer,
  options: {
    trendStyle: TrendStyle;
    brandColorHex?: string | null;
    hookText?: string | null;
    subtitle?: string | null;
    logoBuffer?: Buffer | null;
    logoPosition?: LogoPosition | null;
    textPosition?: TextPosition | null;
    // Which of the 10 cover-catalogue styles this variant uses (see
    // COVER_STYLE_TEXT_TREATMENT) — decides chip vs. floating text and
    // alignment. Undefined (custom/none text modes) falls back to the
    // previous floating-centered look.
    coverStyleId?: number;
    // Only rendered when coverStyleId resolves to a "paragraph" treatment
    // (see COVER_STYLE_TEXT_TREATMENT) — falls back to hookText/subtitle
    // otherwise, even if this happens to be set.
    paragraph?: string | null;
  },
): Promise<string> {
  const cfg = TREND_STYLES[options.trendStyle];
  const rgb = options.brandColorHex ? hexToRgb(options.brandColorHex) : null;
  const hasHookText = Boolean(options.hookText?.trim());
  const hasLogo = Boolean(options.logoBuffer);

  let image = sharp(inputBuffer)
    .rotate()
    .modulate({ brightness: cfg.brightness ?? 1, saturation: cfg.saturation ?? 1 });
  if (cfg.linear) {
    image = image.linear(cfg.linear.a, cfg.linear.b);
  }

  let buffer = await image.jpeg({ quality: 92 }).toBuffer();
  buffer = await cropTo3by4(buffer);
  const { width = 800, height = 800 } = await sharp(buffer).metadata();

  for (const overlay of cfg.overlays ?? []) {
    const overlayRgb = hexToRgb(overlay.color)!;
    const layer = await sharp({
      create: { width, height, channels: 4, background: { ...overlayRgb, alpha: overlay.opacity } },
    })
      .png()
      .toBuffer();
    buffer = await sharp(buffer)
      .composite([{ input: layer, blend: overlay.blend }])
      .jpeg({ quality: 92 })
      .toBuffer();
  }

  if (cfg.grain) {
    buffer = await applyGrainOverlay(buffer, width, height, cfg.grain);
  }
  if (cfg.glow) {
    buffer = await applyGlowOverlay(buffer, width, height, cfg.glow);
  }
  if (cfg.vignette) {
    buffer = await applyVignetteOverlay(buffer, width, height);
  }

  // Layer the brand color in as a light translucent wash on top of whichever
  // trend style got picked, so brand identity still shows through no matter
  // which of the 12 random looks is applied to a given variant.
  if (rgb) {
    const brandOverlay = await sharp({
      create: { width, height, channels: 4, background: { ...rgb, alpha: 0.12 } },
    })
      .png()
      .toBuffer();
    buffer = await sharp(buffer)
      .composite([{ input: brandOverlay, blend: "soft-light" }])
      .jpeg({ quality: 92 })
      .toBuffer();
  }

  if (hasHookText) {
    const baseTreatment =
      (options.coverStyleId !== undefined ? COVER_STYLE_TEXT_TREATMENT[options.coverStyleId] : undefined) ??
      DEFAULT_TEXT_TREATMENT;
    const paragraphText = options.paragraph?.trim();
    const bottomLogoClearance = Math.round(height * 0.22);

    if (baseTreatment.kind === "paragraph" && paragraphText) {
      // Quiet diary-style caption — no chip, no gradient, just a small
      // brush-script block sitting in open space. Its own line count drives
      // the area height instead of the fixed headline band.
      const areaHeight = paragraphAreaHeight(paragraphLines(paragraphText).length, width);
      let top: number;
      if (options.textPosition === "middle") {
        top = Math.round((height - areaHeight) / 2);
      } else if (options.textPosition === "bottom") {
        top = Math.max(0, height - areaHeight - bottomLogoClearance);
      } else {
        top = Math.round(height * 0.13);
      }
      // Sample the actual photo pixels this caption will sit on top of —
      // the trend style's overall mood can be "bright" while this specific
      // strip is dark (e.g. dark clothing/floor in frame), which a
      // whole-photo proxy would miss and render illegible dark-on-dark text.
      // Sample only the horizontal span the glyphs actually occupy (not the
      // full photo width) — for left-aligned text a full-width sample gets
      // diluted by whatever's on the untouched far side of the frame and can
      // pick a color that only suits the empty half, not the text itself.
      const sampleLeft = baseTreatment.align === "left" ? Math.round(width * 0.06) : 0;
      const sampleWidth = baseTreatment.align === "left" ? Math.round(width * 0.55) : width;
      const sampled = await sampleRegionColor(buffer, {
        left: sampleLeft,
        top,
        width: sampleWidth,
        height: areaHeight,
      });
      const ink = pickCaptionInk(sampled);
      const { buffer: overlayBuffer } = await renderParagraphOverlay(paragraphText, width, baseTreatment.align, ink);
      buffer = await sharp(buffer)
        .composite([{ input: overlayBuffer, left: 0, top }])
        .jpeg({ quality: 92 })
        .toBuffer();
    } else if (baseTreatment.kind === "vertical") {
      // A single short phrase set vertically along one edge — reuses
      // hookText directly since it's already a short single line, no
      // dedicated AI field needed for this treatment.
      const areaWidth = verticalAreaWidth(height);
      const sideMargin = Math.round(width * 0.06);
      const left = baseTreatment.side === "left" ? sideMargin : width - areaWidth - sideMargin;
      const sampled = await sampleRegionColor(buffer, { left, top: 0, width: areaWidth, height });
      const ink = pickCaptionInk(sampled);
      const { buffer: overlayBuffer } = await renderVerticalOverlay(
        options.hookText!.trim(),
        height,
        baseTreatment.side,
        ink,
      );
      buffer = await sharp(buffer)
        .composite([{ input: overlayBuffer, left, top: 0 }])
        .jpeg({ quality: 92 })
        .toBuffer();
    } else {
      // Uses the trend style's own caption gradient (not the brand color) so
      // the 3 variants show genuinely different text colors, not just
      // different fonts — brand identity is already carried by the
      // soft-light wash above, applied to every variant regardless of style.
      const hasSubtitle = Boolean(options.subtitle?.trim());
      const headlineTreatment: HeadlineTreatment =
        baseTreatment.kind === "headline" ? baseTreatment : DEFAULT_TEXT_TREATMENT;
      // "middle" sits directly over the busiest part of the photo (that's
      // WHY it was picked over top/bottom — a face/subject blocked those
      // bands) — floating gradient text there reads as covering the photo
      // rather than a deliberate design choice, so force a solid chip block
      // regardless of the cover style's own default.
      const treatment: HeadlineTreatment =
        options.textPosition === "middle" ? { ...headlineTreatment, chip: true } : headlineTreatment;
      const overlayBuffer = await renderCaptionOverlay(
        options.hookText!.trim(),
        width,
        height,
        cfg.captionGradient,
        cfg.fontKey,
        options.subtitle?.trim(),
        treatment,
      );
      // XHS feed thumbnails get their top ~15% covered by the app's own UI
      // chrome, so "top" placement leaves that strip blank and sits in the
      // upper-center third instead of flush against the top edge. "middle"
      // vertically centers instead, and "bottom" sits low but leaves
      // clearance above the bottom-corner logo — Claude picks whichever
      // avoids the photo's face(s) (or has the most open background if
      // there's no face).
      const areaHeight = getCaptionAreaHeight(height, hasSubtitle);
      let top: number;
      if (options.textPosition === "middle") {
        top = Math.round((height - areaHeight) / 2);
      } else if (options.textPosition === "bottom") {
        top = Math.max(0, height - areaHeight - bottomLogoClearance);
      } else {
        top = Math.round(height * 0.13);
      }
      buffer = await sharp(buffer)
        .composite([{ input: overlayBuffer, left: 0, top }])
        .jpeg({ quality: 92 })
        .toBuffer();
    }
  }

  if (hasLogo) {
    const targetLogoWidth = Math.max(32, Math.round(width * 0.18));
    const logoResized = await sharp(options.logoBuffer!)
      .resize({ width: targetLogoWidth })
      .toBuffer();
    const { width: logoWidth = 0, height: logoHeight = 0 } =
      await sharp(logoResized).metadata();

    const padding = Math.round(width * 0.03);
    const isLeft = options.logoPosition === "bottom-left";
    buffer = await sharp(buffer)
      .composite([
        {
          input: logoResized,
          left: isLeft ? padding : Math.max(0, width - logoWidth - padding),
          top: Math.max(0, height - logoHeight - padding),
        },
      ])
      .jpeg({ quality: 92 })
      .toBuffer();
  }

  return uploadBufferToCloudinary(buffer);
}
