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

// Height reserved for the caption overlay — shared with callers so they can
// work out where to composite it (e.g. vertically centering a "middle"
// placement) without duplicating the formula.
export function getCaptionAreaHeight(height: number): number {
  return Math.round(height * 0.22);
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

/**
 * Text sits directly on the photo — no solid banner box — with a gradient
 * fill, a contrast outline, and a soft drop shadow for legibility. Wraps to
 * a second line (shrinking to fit) if the text is too wide for one line.
 * Returns a transparent PNG overlay sized to getCaptionAreaHeight(height).
 */
async function renderCaptionOverlay(
  text: string,
  width: number,
  height: number,
  gradientColors: [string, string],
  captionFont: CaptionFont,
): Promise<Buffer> {
  const areaHeight = getCaptionAreaHeight(height);
  const baseFontSize = Math.round(areaHeight * 0.3);
  const family = getCaptionFontFamily(captionFont);

  const canvas = createCanvas(width, areaHeight);
  const ctx = canvas.getContext("2d");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const maxLineWidth = width * 0.86;
  ctx.font = `${baseFontSize}px "${family}"`;
  const fitsOneLine = ctx.measureText(text).width <= maxLineWidth;

  const lines = fitsOneLine ? [text] : splitIntoTwoLines(text);
  const fontSize = fitsOneLine ? baseFontSize : Math.round(baseFontSize * 0.74);
  ctx.font = `${fontSize}px "${family}"`;

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
  const lineWidth = Math.max(2, Math.round(fontSize * 0.09));
  const lineHeight = fontSize * 1.25;
  const startY = areaHeight / 2 - (lineHeight * (lines.length - 1)) / 2;

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight;

    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.strokeStyle = outlineColor;
    ctx.strokeText(lines[i], width / 2, y);

    // Fill goes on top without its own shadow — the stroke pass above
    // already provided the depth/contrast.
    ctx.shadowColor = "transparent";
    ctx.fillStyle = gradient;
    ctx.fillText(lines[i], width / 2, y);
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
 * naturally avoids picking similar moods.
 */
export function pickRandomTrendStyles(count: number): TrendStyle[] {
  const keys = Object.keys(TREND_STYLES) as TrendStyle[];
  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

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
    logoBuffer?: Buffer | null;
    logoPosition?: LogoPosition | null;
    textPosition?: TextPosition | null;
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
    // Uses the trend style's own caption gradient (not the brand color) so
    // the 3 variants show genuinely different text colors, not just
    // different fonts — brand identity is already carried by the soft-light
    // wash above, applied to every variant regardless of style.
    const overlayBuffer = await renderCaptionOverlay(options.hookText!.trim(), width, height, cfg.captionGradient, cfg.fontKey);
    // XHS feed thumbnails get their top ~15% covered by the app's own UI
    // chrome, so "top" placement leaves that strip blank and sits in the
    // upper-center third instead of flush against the top edge. "middle"
    // vertically centers instead — Claude picks whichever has more open
    // background in the specific photo.
    const areaHeight = getCaptionAreaHeight(height);
    const top =
      options.textPosition === "middle"
        ? Math.round((height - areaHeight) / 2)
        : Math.round(height * 0.13);
    buffer = await sharp(buffer)
      .composite([{ input: overlayBuffer, left: 0, top }])
      .jpeg({ quality: 92 })
      .toBuffer();
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
