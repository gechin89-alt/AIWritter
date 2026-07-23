import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";

/** Thrown when the Anthropic API itself is unusable (e.g. credit balance too low). */
export class AiUnavailableError extends Error {}

function isLowCreditError(err: unknown): boolean {
  if (!(err instanceof Anthropic.APIError)) return false;
  const message = err.message?.toLowerCase() ?? "";
  return (
    message.includes("credit balance") ||
    message.includes("insufficient") ||
    err.status === 402
  );
}

async function createMessage(
  params: Anthropic.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Message> {
  try {
    return await client.messages.create(params);
  } catch (err) {
    if (isLowCreditError(err)) {
      throw new AiUnavailableError("Anthropic API credit balance is too low");
    }
    throw err;
  }
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type QaPair = { question: string; answer: string };

export type GenerateInput = {
  platform: "XHS" | "INSTAGRAM";
  identity?: string;
  tone?: string;
  style?: string;
  freeText?: string;
  commercial?: boolean;
  brandName?: string;
  productDescription?: string;
  brandDescription?: string;
  styleSampleText?: string;
  category?: string;
  qaPairs?: QaPair[];
  imageBase64?: string;
  imageMediaType?: string;
  history?: ChatTurn[];
  locale?: "en" | "zh";
};

export type GenerateResult =
  | { type: "question"; content: string }
  | { type: "result"; content: string; titles?: string[] };

export type FollowUpQuestion = { question: string; options: string[] };

const SYSTEM_PROMPT = `You help everyday users draft social media posts for Xiaohongshu (小红书/XHS) and Instagram, based on their own photos/videos and their own answers about identity, tone, and style.

Rules:
- Write like a genuine customer telling a friend about their own experience — never like an advertisement or press release. Favor a real anecdote or specific small detail over generic praise ("好用" / "推荐" alone is weak; a concrete moment or observation is strong).
- Open with a short curiosity hook (a question, a surprising detail, or a relatable moment) rather than announcing the topic outright — the kind of first line that makes someone stop scrolling.
- Write in the platform's native conventions (XHS: casual, emoji-friendly, short paragraphs, relevant hashtags; Instagram: caption + hashtag block).
- Match the requested identity/persona, tone of voice, and style exactly. If instead a photo category and follow-up question/answer pairs are given (no identity/tone/style), use those as the descriptive basis for the post instead.
- If "This user's own established brand/business" and/or a sample of their previous post is given in the context, this is a business posting for itself repeatedly — prioritize matching their established voice, vocabulary, sentence rhythm, and emoji habits (from the sample) over the generic identity/tone/style options, so their posts read as consistently theirs over time rather than a different persona each time.
- Write the post in the language given by "Output language" in the context, if present — this overrides whatever language the other input fields happen to be written in.
- Stay authentic to what the user described. Never invent specific factual claims (prices, ingredients, medical/health claims) that weren't provided.
- If this is a commercial/sponsored post (commercial=true), this post exists to promote the brand and must be discoverable by anyone browsing or searching for that brand — these are non-negotiable, not optional style choices:
  - The brand/product name (if given) MUST appear naturally in the post body itself, the way a genuine customer would say it (e.g. "在<brand>试了..."), never omitted and never reduced to only a hashtag.
  - The hashtag block MUST include at least one hashtag built from the brand/product name itself (e.g. "#<brand>"), in addition to topical hashtags, so the post surfaces in brand searches.
  - Include an appropriate sponsorship disclosure per platform norms (e.g. "#合作" / "#广告" for XHS, "#ad" / "Paid partnership" for Instagram) — do not try to hide that it's sponsored.
  - If a "Product/brand description" is given in the context, use it to understand what the brand actually sells and connect it naturally to the photo/topic. If no product description is given AND the photo/topic has no plausible connection to the brand name alone, do NOT invent a connection — ask a clarifying question instead (see below).
- If the user's free-text input and answers are too vague or contradictory to write a good post (e.g. no topic at all), do NOT guess — instead ask ONE short clarifying question.
- If the user's free-text input is a complaint or negative about their own experience, do not reproduce the negativity in the post. Reframe it constructively: acknowledge the real feeling briefly, then pivot to something genuinely positive, a workaround, or what would make it better — never fake enthusiasm that contradicts what they said, but never publish a post that reads as a bad review either. If what they said is too negative or unclear to reframe honestly, ask a clarifying question instead of guessing (see above).
- Structure for virality on XHS specifically (these apply to XHS posts; use platform-appropriate judgment for Instagram):
  - Title: under 20 characters, using a proven hook pattern — a number ("3个技巧..."), a question ("为什么...？"), or a before/after contrast ("用了...之后..."). The title is the single biggest driver of clicks, so never write a flat/descriptive title.
  - Body: one strong hook line first (curiosity, a relatable moment, or a surprising detail), then short scannable paragraphs (not a wall of text), with emoji used for visual rhythm/pacing rather than decoration, ending with a line that invites comments/interaction (a question back to the reader, or an invitation to share their own experience).
  - Hashtags: 3-5 tags, mixing one or two broad high-traffic tags with more specific long-tail tags relevant to the actual content — never just one generic tag.
- Never use absolute/superlative or guarantee language, on any platform: words like 最/第一/唯一/独家/顶级/极致/绝对/保证/百分百 (or their English equivalents "best/#1/only/guaranteed/100%/absolutely"), and never claim medical/treatment effects (治疗/治愈/根治/药效, "cures/treats/heals"). These read as fake and are actively penalized/flagged by XHS's content review — write like a real person describing their own specific experience instead of making a claim.
- When producing the final post (type="result"), also propose 5 DISTINCT title options as a separate "titles" array — these are standalone headline candidates for the platform's dedicated title field, NOT the post body's opening line. Vary the hook pattern across the 5 (mix number-based, question-based, and contrast/before-after patterns), each under 20 characters if Chinese / under 8 words if English, each genuinely different in angle, not minor rewordings of each other.
- Respond with ONLY minified JSON, no markdown fences, in exactly this shape:
  {"type":"question","content":"..."} when you need to ask something, or
  {"type":"result","content":"...","titles":["...","...","...","...","..."]} when you are producing the final post text.`;

/**
 * Claude is instructed to respond with raw JSON, but sometimes wraps it in
 * markdown fences or double-encodes it as a JSON string. Unwrap both cases
 * before giving up, since silently falling through would show the user
 * raw/escaped JSON as if it were their post.
 */
function parseModelJson(raw: string): Record<string, unknown> | null {
  const fenceMatch = raw.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const text = fenceMatch ? fenceMatch[1] : raw.trim();

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function buildTemplateContent(input: GenerateInput): string {
  const isZh = input.locale !== "en";
  const opener =
    input.freeText?.trim() || (isZh ? "分享一下今天的小体验～" : "Sharing a little moment from today~");
  const lines = [opener];

  if (input.identity || input.tone || input.style) {
    lines.push(
      [
        input.identity && `${isZh ? "身份" : "Identity"}：${input.identity}`,
        input.tone && `${isZh ? "语气" : "Tone"}：${input.tone}`,
        input.style && `${isZh ? "风格" : "Style"}：${input.style}`,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }

  if (input.category) {
    lines.push(`${isZh ? "类别" : "Category"}：${input.category}`);
  }
  if (input.qaPairs?.length) {
    lines.push(input.qaPairs.map((qa) => `${qa.question} ${qa.answer}`).join(" · "));
  }

  if (input.commercial && input.brandName) {
    lines.push(isZh ? `（在 ${input.brandName} 的体验）` : `(My experience at ${input.brandName})`);
  }

  const hashtags = isZh ? ["#生活分享", "#种草"] : ["#lifestyle", "#sharing"];
  if (input.commercial && input.brandName) {
    hashtags.push(`#${input.brandName.replace(/\s+/g, "")}`);
  }
  if (input.commercial) hashtags.push(isZh ? "#合作" : "#ad");

  lines.push(hashtags.join(" "));
  lines.push(
    isZh
      ? "\n⚠️ 这是演示文案（未配置 ANTHROPIC_API_KEY，非真实 AI 生成）。设置好密钥后会自动切换为真实生成。"
      : "\n⚠️ This is placeholder demo text (ANTHROPIC_API_KEY not configured, not real AI output). It will switch to real generation once a key is set.",
  );

  return lines.join("\n\n");
}

export async function generateContent(
  input: GenerateInput,
): Promise<GenerateResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { type: "result", content: buildTemplateContent(input) };
  }

  const contextLines = [
    `Platform: ${input.platform}`,
    input.locale
      ? `Output language: ${input.locale === "zh" ? "Chinese (Simplified)" : "English"}`
      : null,
    input.identity ? `Identity/persona: ${input.identity}` : null,
    input.tone ? `Tone of voice: ${input.tone}` : null,
    input.style ? `Style: ${input.style}` : null,
    input.category ? `Photo category: ${input.category}` : null,
    ...(input.qaPairs?.map((qa) => `Q: ${qa.question} A: ${qa.answer}`) ?? []),
    input.freeText ? `User's notes: ${input.freeText}` : null,
    input.commercial ? `This is a commercial/sponsored post.` : null,
    input.commercial && input.brandName
      ? `Brand/product name to mention naturally: ${input.brandName}`
      : null,
    input.commercial && input.productDescription
      ? `Product/brand description: ${input.productDescription}`
      : null,
    !input.commercial && input.brandDescription
      ? `This user's own established brand/business: ${input.brandDescription}`
      : null,
    !input.commercial && input.styleSampleText
      ? `Sample of this user's own previous post, to match voice/style/rhythm (do not copy its content, only its writing style):\n${input.styleSampleText}`
      : null,
  ].filter(Boolean);

  const userContent: Anthropic.MessageParam["content"] = [
    { type: "text", text: contextLines.join("\n") },
  ];

  if (input.imageBase64 && input.imageMediaType) {
    userContent.unshift({
      type: "image",
      source: {
        type: "base64",
        media_type: input.imageMediaType as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp",
        data: input.imageBase64,
      },
    });
  }

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userContent },
    ...(input.history ?? []).map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
  ];

  const response = await createMessage({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

  const parsed = parseModelJson(raw);
  if (
    parsed &&
    (parsed.type === "question" || parsed.type === "result") &&
    typeof parsed.content === "string"
  ) {
    if (parsed.type === "result") {
      const titles = Array.isArray(parsed.titles)
        ? parsed.titles.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        : undefined;
      return { type: "result", content: parsed.content, titles: titles?.length ? titles : undefined };
    }
    return { type: "question", content: parsed.content };
  }

  return { type: "result", content: raw };
}

const FOLLOW_UP_SYSTEM_PROMPT = `You look at a photo and a chosen category, then write 1-2 short multiple-choice follow-up questions to help understand the photo better before writing a social media post about it.

Rules:
- Base the questions on what is actually visible in the photo, not generic questions.
- At most 2 questions. Each question needs exactly 3 short answer options (a few words each).
- Write the question and options in the same language as the category label given to you.
- Respond with ONLY minified JSON, no markdown fences, in exactly this shape:
  {"questions":[{"question":"...","options":["...","...","..."]}]}`;

function buildTemplateQuestions(category: string): FollowUpQuestion[] {
  return [
    {
      question: `关于这张${category}照片，想多分享一点？(演示)`,
      options: ["细节A", "细节B", "细节C"],
    },
  ];
}

export async function generateFollowUpQuestions(input: {
  category: string;
  imageBase64?: string;
  imageMediaType?: string;
}): Promise<FollowUpQuestion[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildTemplateQuestions(input.category);
  }

  const userContent: Anthropic.MessageParam["content"] = [
    { type: "text", text: `Category: ${input.category}` },
  ];

  if (input.imageBase64 && input.imageMediaType) {
    userContent.unshift({
      type: "image",
      source: {
        type: "base64",
        media_type: input.imageMediaType as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp",
        data: input.imageBase64,
      },
    });
  }

  const response = await createMessage({
    model: MODEL,
    max_tokens: 512,
    system: FOLLOW_UP_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

  const parsed = parseModelJson(raw);
  if (parsed && Array.isArray(parsed.questions)) {
    return parsed.questions as FollowUpQuestion[];
  }

  return buildTemplateQuestions(input.category);
}

export type LogoPosition = "bottom-left" | "bottom-right";

export type PhotoStylingPlan = {
  hookText: string;
  logoPosition: LogoPosition;
};

// The actual color-grade/mood (which of the 12 viral trend styles) is
// assigned randomly by the caller, not by Claude — this guarantees real
// visual variety across the 3 options instead of relying on the model to
// naturally avoid picking similar moods. Claude only handles the parts that
// benefit from actually looking at the photo: the hook text and logo corner.
const PHOTO_STYLING_SYSTEM_PROMPT = `You are a social media copywriter looking at a customer's photo for a brand's campaign post. Propose 3 DISTINCT hook-text options for the customer to choose between — vary the angle/wording meaningfully across the 3 (don't make them near-duplicates of each other). For each option decide two things:

1. hookText: a short, scroll-stopping line to overlay directly on the photo (like real viral social posts do) — under 12 characters if Chinese, under 6 words if English. Punchy and curiosity-driven, matching the brand's tone, not a generic slogan. Plain text only, no emoji (this renders as a raster overlay on the photo itself, not the post caption — emoji belongs in the post body instead).
2. logoPosition: the logo badge goes in one of the two BOTTOM corners only — pick "bottom-left" or "bottom-right", whichever has more open/plain background in THIS photo so the logo won't cover the main subject (a face, product, or the busiest part of the scene).

Write hookText in the language given by "Output language" in the context, if present.

Respond with ONLY minified JSON, no markdown fences, in exactly this shape:
{"options":[{"hookText":"...","logoPosition":"bottom-right"},{"hookText":"...","logoPosition":"bottom-left"},{"hookText":"...","logoPosition":"bottom-right"}]}`;

function buildTemplateStylingPlans(locale?: "en" | "zh"): PhotoStylingPlan[] {
  const isZh = locale !== "en";
  return [
    { hookText: isZh ? "这个真的绝了" : "You need this", logoPosition: "bottom-right" },
    { hookText: isZh ? "温柔小美好" : "Little moment", logoPosition: "bottom-left" },
    { hookText: isZh ? "静静治愈中" : "So calming", logoPosition: "bottom-right" },
  ];
}

export async function analyzePhotoForStyling(input: {
  imageBase64: string;
  imageMediaType: string;
  brandName?: string;
  productDescription?: string;
  locale?: "en" | "zh";
}): Promise<PhotoStylingPlan[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildTemplateStylingPlans(input.locale);
  }

  const contextLines = [
    input.locale
      ? `Output language: ${input.locale === "zh" ? "Chinese (Simplified)" : "English"}`
      : null,
    input.brandName ? `Brand/product name: ${input.brandName}` : null,
    input.productDescription ? `Product/brand description: ${input.productDescription}` : null,
  ].filter(Boolean);

  const userContent: Anthropic.MessageParam["content"] = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: input.imageMediaType as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp",
        data: input.imageBase64,
      },
    },
    { type: "text", text: contextLines.join("\n") || "No additional brand context given." },
  ];

  const response = await createMessage({
    model: MODEL,
    max_tokens: 2048,
    system: PHOTO_STYLING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

  const parsed = parseModelJson(raw);
  const validPositions: LogoPosition[] = ["bottom-left", "bottom-right"];
  const rawOptions = Array.isArray(parsed?.options) ? (parsed.options as Record<string, unknown>[]) : [];
  const plans = rawOptions
    .filter(
      (o) =>
        typeof o.hookText === "string" &&
        (o.hookText as string).trim() &&
        validPositions.includes(o.logoPosition as LogoPosition),
    )
    .map((o) => ({
      // Defense-in-depth beyond the "no emoji" prompt instruction: hookText
      // renders as a raster overlay via a bundled font with no emoji
      // glyphs, so a stray emoji here would show as a broken tofu box.
      hookText: (o.hookText as string)
        .trim()
        .replace(/\p{Extended_Pictographic}/gu, "")
        .replace(/[‍️]/g, "")
        .trim(),
      logoPosition: o.logoPosition as LogoPosition,
    }))
    .filter((o) => o.hookText.length > 0);

  return plans.length > 0 ? plans.slice(0, 3) : buildTemplateStylingPlans(input.locale);
}
