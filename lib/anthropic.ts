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
  | { type: "question"; content: string; suggestReupload?: boolean }
  | { type: "result"; content: string; titles?: string[] };

export type FollowUpQuestion = { question: string; options: string[] };

// Compiled from xhs_top10_content_styles.md — 10 proven high-performing XHS
// writing patterns, each engineered around a specific algorithm signal
// (completion rate, saves, or comments). Claude picks whichever ONE fits
// this specific post best instead of writing every post the same generic
// way — the same "pick the best-fit archetype" pattern already used for
// photo cover styles.
const XHS_CONTENT_STYLES = `10 proven XHS writing styles — pick whichever ONE fits this specific post best and let it shape the body's structure/rhythm (never name the style in your output, just write in that pattern):
1. 反差体 (Contrast/Reversal) — set up an expectation, then flip it hard in the first line or two: "都说...结果..."
2. 干货体 (Value-Dump/How-To) — problem → cause → solution → summary, front-loaded so it reads as worth saving even half-read.
3. 痛点共鸣体 (Pain-Point Empathy) — hit the reader's pain point, build resonance through a real personal story, then pivot to a concrete solution.
4. AIDA种草体 (Product Seeding) — hook problem → product/ingredient logic → real demo → soft CTA; describe how it FEELS (sensory), not specs.
5. 悬念标题体 (Curiosity-Gap Titling) — the title/opening withholds the payoff; the body resolves the tension it created.
6. 萌系趣味体 (Cute/Humor) — light, no real "point" beyond entertainment/awww-factor, casual meme-adjacent tone, heavy emoji.
7. 情绪宣泄体 (Emotional Venting) — raw diary-style confession, fragmented sentences, rhetorical questions, minimal formal structure.
8. 反问互动体 (Rhetorical Question) — ends with a direct question aimed squarely at the reader, built to draw a comment reply.
9. 稀缺紧迫体 (Scarcity/Urgency) — time/quantity pressure language — only use this if the context actually gives a real deadline/limited quantity (e.g. a campaign's real end date), never fabricate urgency that isn't there.
10. 结构化合集体 (Curated List/Compilation) — "X个/件 + category" numbered roundup, one short tag line per item, no long paragraphs.`;

const SYSTEM_PROMPT = `You help everyday users draft social media posts for Xiaohongshu (小红书/XHS) and Instagram, based on their own photos/videos and their own answers about identity, tone, and style.

${XHS_CONTENT_STYLES}

Rules:
- Write like a genuine customer telling a friend about their own experience — never like an advertisement or press release. Favor a real anecdote or specific small detail over generic praise ("好用" / "推荐" alone is weak; a concrete moment or observation is strong).
- Open with a short curiosity hook (a question, a surprising detail, or a relatable moment) rather than announcing the topic outright — the kind of first line that makes someone stop scrolling.
- Write in the platform's native conventions. For XHS specifically: casual tone, short paragraphs, relevant hashtags, and emoji used LIBERALLY throughout the body (real viral XHS posts sprinkle an emoji every line or two for visual rhythm, not just one or two for decoration — err on the side of more, matching genuine XHS posting habits) — never a flat block of plain text. Instagram: caption + hashtag block, more restrained emoji use is fine there.
- Match the requested identity/persona, tone of voice, and style exactly. If instead a photo category and follow-up question/answer pairs are given (no identity/tone/style), use those as the descriptive basis for the post instead.
- If "This user's own established brand/business" and/or a sample of their previous post is given in the context, this is a business posting for itself repeatedly — prioritize matching their established voice, vocabulary, sentence rhythm, and emoji habits (from the sample) over the generic identity/tone/style options, so their posts read as consistently theirs over time rather than a different persona each time.
- Write the post in the language given by "Output language" in the context, if present — this overrides whatever language the other input fields happen to be written in.
- Stay authentic to what the user described. Never invent specific factual claims (prices, ingredients, medical/health claims) that weren't provided.
- If this is a commercial/sponsored post (commercial=true), this post exists to promote the brand and must be discoverable by anyone browsing or searching for that brand — these are non-negotiable, not optional style choices:
  - The brand/product name (if given) MUST appear naturally in the post body itself, the way a genuine customer would say it (e.g. "在<brand>试了..."), never omitted and never reduced to only a hashtag.
  - The hashtag block MUST include at least one hashtag built from the brand/product name itself (e.g. "#<brand>"), in addition to topical hashtags, so the post surfaces in brand searches.
  - Include an appropriate sponsorship disclosure per platform norms (e.g. "#合作" / "#广告" for XHS, "#ad" / "Paid partnership" for Instagram) — do not try to hide that it's sponsored.
  - If a "Product/brand description" is given in the context, use it to understand what the brand actually sells and connect it naturally to the photo/topic. If no product description is given AND the photo/topic has no plausible connection to the brand name alone, do NOT invent a connection — ask a clarifying question instead (see below).
- If the user's free-text input and answers are too vague or contradictory to write a good post (e.g. no topic at all), do NOT guess — instead ask ONE short clarifying question. Only keep asking for as long as genuinely needed: the moment they give you any specific, usable detail (a concrete moment, a specific reaction, a quote, anything you can actually write from) — even after just 1 or 2 rounds — stop asking and write the finished post immediately. Do not keep asking for more specificity just to reach some target number of rounds; a positive/clear-enough answer never needs to be dragged out. If it genuinely stays too vague to write anything real, you may ask up to 3 rounds total (check the conversation history for how many clarifying questions you've already asked in this thread) — but by your 4th response in this thread you MUST produce the finished post regardless, using whatever was given, never asking a 4th clarifying question. Check the context for whether a photo has been provided: if none has, never ask about, reference, or suggest sharing a photo/moment-to-share in your question — ask about their experience/story in words only, since they haven't reached the photo step yet.
- If a photo HAS been provided (per the context) and the user's answer indicates that photo itself is wrong/mismatched (e.g. they say they uploaded the wrong photo, or a prior question already established the photo doesn't connect to the brand and they haven't resolved it), ask a clarifying question that also offers the option to upload a different photo, and set "suggestReupload":true in your JSON response so the app can show a direct re-upload action alongside your question. Only set this when the photo itself is the actual problem, and only when a photo actually exists in context — never when none has been provided.
- If anything the user wrote is a complaint or negative — whether in their free-text input, a follow-up question answer, or a custom identity/tone/style "other" entry — do not reproduce that negativity in the post (this is being used to promote a brand; a post that reads as a bad review defeats the purpose). Reframe it constructively: acknowledge the real feeling briefly, then pivot to something genuinely positive, a workaround, or what would make it better — never fake enthusiasm that contradicts what they said, but never publish a post that reads as a bad review either. If what they said is too negative or unclear to reframe honestly, ask a clarifying question instead of guessing (see above). The moment they give you something genuinely positive to work with, stop escalating and write the finished post from it immediately — do not keep pushing through more rounds just because you haven't used all 3 yet. Otherwise, you may spend up to 3 rounds of clarifying questions trying to turn it around — check the conversation history for how many you've already asked on this — varying the angle each round rather than repeating yourself:
  1. First, stay on the SAME specific thing they complained about and offer a good-faith mitigating reason (e.g. that might have been a one-off/an off day), inviting them to reconsider it or give it another chance.
  2. If they're still negative, pivot to asking directly about the product/activity's actual effect or content — something concrete and unrelated to the complaint they can speak to instead.
  3. If still nothing positive, ask plainly whether there's any positive detail at all worth sharing, however small.
  After 3 rounds, if they still haven't offered anything usable, write the post from whatever neutral/factual details they did give — measured and honest, never inventing enthusiasm that contradicts them. Do not keep asking indefinitely.
- Structure for virality on XHS specifically (these apply to XHS posts; use platform-appropriate judgment for Instagram):
  - Title: under 20 characters, using a proven hook pattern — a number ("3个技巧..."), a question ("为什么...？"), or a before/after contrast ("用了...之后..."). The title is the single biggest driver of clicks, so never write a flat/descriptive title.
  - Body: one strong hook line first (curiosity, a relatable moment, or a surprising detail), then short scannable paragraphs (not a wall of text), with emoji used for visual rhythm/pacing rather than decoration, ending with a line that invites comments/interaction (a question back to the reader, or an invitation to share their own experience).
  - Hashtags: 3-5 tags, mixing one or two broad high-traffic tags with more specific long-tail tags relevant to the actual content — never just one generic tag.
- Avoid XHS's commonly-flagged/penalized language, on any platform: absolute/superlative or guarantee words (最/第一/唯一/独家/顶级/极致/绝对/保证/百分百, or English "best/#1/only/guaranteed/100%/absolutely"); medical/treatment claims (治疗/治愈/根治/药效, "cures/treats/heals"); and pushing the conversation off-platform (do not write things like "加我微信"/"私信我领取福利" — a lucky-draw/campaign context already has its own official submission flow, so never invent a separate off-platform contact prompt). These all read as fake or against platform policy — write like a real person describing their own specific experience instead of making a claim or a sales pitch.
- When producing the final post (type="result"), also propose 5 DISTINCT title options as a separate "titles" array — these are standalone headline candidates for the platform's dedicated title field, NOT the post body's opening line. Vary the hook pattern across the 5 (mix number-based, question-based, and contrast/before-after patterns), each under 20 characters if Chinese / under 8 words if English, each genuinely different in angle, not minor rewordings of each other.
- Respond with ONLY minified JSON, no markdown fences, in exactly this shape:
  {"type":"question","content":"..."} when you need to ask something (add "suggestReupload":true per the rule above when relevant), or
  {"type":"result","content":"...","titles":["...","...","...","...","..."]} when you are producing the final post text.
  Never mix these up: "content" under "type":"result" must always be the complete, finished post itself (hook line, body, hashtags) — never a question, not even a last attempt to gather more info. If you still need to ask the user something, that is always "type":"question", regardless of how many rounds of questions you've already asked.`;

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
    // Recovery: the model's JSON is sometimes malformed even though the
    // fields we actually need are intact — a literal unescaped newline
    // inside a string, a truncated tail. Pull "type"/"content"/"titles" out
    // with a tolerant regex instead of giving up — giving up here
    // previously showed the raw, half-broken JSON text to the customer as
    // if it were their post.
    const typeMatch = text.match(/"type"\s*:\s*"(question|result)"/);
    // Character classes ([^"\\], [^\]]) already span newlines without the
    // "s"/dotAll flag, which the project's TS target doesn't support.
    const contentMatch = text.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (!typeMatch || !contentMatch) return null;
    let content: string;
    try {
      content = JSON.parse(`"${contentMatch[1]}"`);
    } catch {
      content = contentMatch[1];
    }
    const titlesMatch = text.match(/"titles"\s*:\s*(\[[^\]]*\])/);
    let titles: unknown;
    if (titlesMatch) {
      try {
        titles = JSON.parse(titlesMatch[1]);
      } catch {
        titles = undefined;
      }
    }
    return { type: typeMatch[1], content, ...(titles ? { titles } : {}) };
  }

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;

  // Rare model slip: instead of the flat {"type":"question"|"result",...}
  // shape, it nests one inside the other's "content" field (e.g.
  // {"type":"result","content":"{\"type\":\"question\",...}"}). Unwrap one
  // level so the inner, actually-intended structure wins — otherwise this
  // would show raw JSON to the customer as if it were their post.
  if (typeof obj.content === "string" && /^\s*\{/.test(obj.content)) {
    try {
      const inner = JSON.parse(obj.content);
      if (inner && typeof inner === "object" && "type" in inner) {
        return inner as Record<string, unknown>;
      }
    } catch {
      // Not actually nested JSON — fall through and use obj as-is.
    }
  }

  return obj;
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
    input.imageBase64 && input.imageMediaType
      ? "A photo has been provided for this post."
      : "No photo has been provided for this post — do not ask about, reference, or suggest one.",
    input.identity ? `Identity/persona: ${input.identity}` : null,
    input.tone ? `Tone of voice: ${input.tone}` : null,
    input.style ? `Style: ${input.style}` : null,
    input.category ? `Category: ${input.category}` : null,
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
    // Defense against an observed model reliability issue: it occasionally
    // mislabels a follow-up question as "result", especially right after a
    // regenerate call. A real finished post always contains at least one
    // hashtag (the prompt requires 3-5), so "result" content with none at
    // all is almost certainly a mislabeled question - re-typed here rather
    // than showing half a question to the customer as if it were their post.
    if (parsed.type === "result" && !parsed.content.includes("#")) {
      return { type: "question", content: parsed.content, suggestReupload: false };
    }
    if (parsed.type === "result") {
      const titles = Array.isArray(parsed.titles)
        ? parsed.titles.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        : undefined;
      return { type: "result", content: parsed.content, titles: titles?.length ? titles : undefined };
    }
    return { type: "question", content: parsed.content, suggestReupload: parsed.suggestReupload === true };
  }

  // The prompt requires ONLY minified JSON — if we still can't recover a
  // usable shape even with parseModelJson's tolerant regex fallback, the
  // response is genuinely broken. Previously this returned the raw,
  // unparsed text as if it were the finished post, which could show literal
  // JSON syntax to the customer. Fail loudly instead so the caller shows a
  // normal "please try again" error, same as any other generation failure.
  throw new Error("Model response was not valid JSON and could not be recovered");
}

const FOLLOW_UP_SYSTEM_PROMPT = `You take a product/experience category, and optionally a brand/product to promote, and write 1-2 short multiple-choice follow-up questions that draw out the customer's genuine feedback/experience before writing a social media post about it. The customer has NOT uploaded a photo at this point in the flow — never reference, assume, or ask about a photo.

Rules:
- Ask about their actual opinion/experience with the category (and the brand/product, if given) — e.g. what stood out, what they liked or didn't, how it compares to what they expected — not generic filler questions.
- At most 2 questions. Each question needs exactly 3 short answer options (a few words each).
- Write the question and options in the same language as the category label given to you.
- Respond with ONLY minified JSON, no markdown fences, in exactly this shape:
  {"questions":[{"question":"...","options":["...","...","..."]}]}`;

function buildTemplateQuestions(category: string): FollowUpQuestion[] {
  return [
    {
      question: `关于${category}，想多分享一点你的感受？(演示)`,
      options: ["细节A", "细节B", "细节C"],
    },
  ];
}

export async function generateFollowUpQuestions(input: {
  category: string;
  brandName?: string;
  productDescription?: string;
}): Promise<FollowUpQuestion[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildTemplateQuestions(input.category);
  }

  const contextLines = [
    `Category: ${input.category}`,
    input.brandName ? `Brand/product name: ${input.brandName}` : null,
    input.productDescription ? `Product/brand description: ${input.productDescription}` : null,
  ].filter(Boolean);

  const response = await createMessage({
    model: MODEL,
    max_tokens: 512,
    system: FOLLOW_UP_SYSTEM_PROMPT,
    messages: [{ role: "user", content: contextLines.join("\n") }],
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
export type TextPosition = "top" | "middle" | "bottom";
// "auto": Claude invents 3 distinct hookText options from scratch.
// "custom": the user wrote their own text; Claude only polishes it (keeps
// their meaning) and decides placement — one shared plan reused across the
// 3 style variants, since the text itself doesn't vary.
// "none": no text at all — fastest path, skips the copywriting entirely.
export type TextMode = "auto" | "custom" | "none";

export type PhotoStylingPlan = {
  hookText: string; // "" means no text overlay (textMode "none")
  // A smaller supporting line under the headline (e.g. headline "深夜解压仪式"
  // + subtitle "一滴精油，治愈一整天") — matches real XHS "大字报" covers,
  // which pair a bold big-character hook with a softer secondary line
  // instead of a single flat line of text. Only set in "auto" text mode.
  subtitle?: string;
  // Only set for coverStyleId 5 (Confessional/Story Hook) and 9 (Real-Life/
  // Lived-In Scene) — a short 2-4 line reflective/diary-style caption
  // rendered in a delicate brush-script font instead of the bold headline,
  // matching a quieter editorial look some brands want over a punchy ad
  // hook. Replaces hookText/subtitle for rendering when present.
  paragraph?: string;
  logoPosition: LogoPosition;
  textPosition: TextPosition;
  // Which of the 10 viral XHS cover archetypes this variant is styled as
  // (see COVER_STYLE_CATALOGUE below), and why Claude picked it for this
  // specific photo — shown to the customer alongside the 3 options instead
  // of leaving the choice unexplained. Only set in "auto" text mode.
  coverStyleId?: number;
  coverStyleReason?: string;
};

// Compiled from XHS_Viral_Cover_Catalogue.md — 10 proven cover
// composition/psychological-hook archetypes (distinct from the 12 color-grade
// "trend styles" in lib/image-filter.ts, which handle the actual rendering).
// Claude picks WHICH of these fits a given photo; COVER_STYLE_TO_TREND_STYLE
// in image-filter.ts maps each pick to a rendering recipe.
const COVER_STYLE_CATALOGUE = `10 proven viral XiaoHongShu cover styles:
1. Real-Person Direct Shot — subject in-frame, natural pose, builds instant trust.
2. Before/After Transformation — split or sequential frame with a measurable result.
3. Bold Headline / Color Block — no photo needed, big text on a saturated color block.
4. Pain Point + Contrast Portrait — subject mid-demonstration, clean background, empathy/trust.
5. Confessional / Story Hook — ordinary scene reframed with a personal secret/reveal angle.
6. Reveal-Half Suspense Hook — result-first framing, cause/detail withheld to force a click.
7. Two-Person Interactive Frame — two people in physical/social interaction.
8. Cross-Category Mashup — two unrelated visual/topic worlds combined for novelty.
9. Real-Life / Lived-In Scene — authentic, unstaged, natural light, an "in-use" moment.
10. Minimalist Infographic — solid background, big headline, data/screenshot-style clarity.`;

export const COVER_STYLE_NAMES: Record<number, { en: string; zh: string }> = {
  1: { en: "Real-Person Direct Shot", zh: "真人出镜" },
  2: { en: "Before/After Transformation", zh: "前后对比" },
  3: { en: "Bold Headline / Color Block", zh: "大字报" },
  4: { en: "Pain Point + Contrast Portrait", zh: "痛点共情" },
  5: { en: "Confessional / Story Hook", zh: "私密故事感" },
  6: { en: "Reveal-Half Suspense Hook", zh: "悬念半遮面" },
  7: { en: "Two-Person Interactive Frame", zh: "双人互动" },
  8: { en: "Cross-Category Mashup", zh: "跨界混搭" },
  9: { en: "Real-Life / Lived-In Scene", zh: "生活真实感" },
  10: { en: "Minimalist Infographic", zh: "极简资讯" },
};

function sanitizeHookText(text: string): string {
  // Defense-in-depth beyond the "no emoji" prompt instructions: hookText
  // renders as a raster overlay via a bundled font with no emoji glyphs, so
  // a stray emoji here would show as a broken tofu box.
  return text
    .trim()
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[‍️]/g, "")
    .trim();
}

const LOGO_POSITION_RULE = `logoPosition: the logo badge goes in one of the two BOTTOM corners only — pick "bottom-left" or "bottom-right", whichever has more open/plain background in THIS photo so the logo won't cover the main subject (a face, product, or the busiest part of the scene).`;

// Face-avoidance is done ONCE per photo (faceOverlap), not re-decided
// per hook-text option — asking the model to re-judge the same photo's face
// position 3 separate times (once per option) was measurably less reliable
// than one judgment applied deterministically by code. See
// resolveTextPositions() below.
const FACE_OVERLAP_RULE = `Before anything else, look at the WHOLE photo once (this is the same regardless of the hook-text options below) and determine, for each of these 3 text bands, whether ANY face overlaps it (there may be more than one face — a group photo, a couple, etc. — a band counts as blocked if it overlaps any face at all, even partially):
- "top": the upper third of the photo
- "middle": vertically centered
- "bottom": the lower area, above where a logo badge would sit
Report this as "faceOverlap": {"top":bool,"middle":bool,"bottom":bool}. Also report "leastBadPosition": the one of the three that overlaps a face the LEAST (used only as a fallback if a face is so large it overlaps all three bands).`;

const HOOK_TEXT_RULES = `one short line, or two lines if it reads naturally split (e.g. at a comma or natural phrase break), roughly 4-16 characters if Chinese, 3-10 words if English. Plain text only, no emoji (this renders as a raster overlay on the photo itself, not the post caption — emoji belongs in the post body instead). Never invent a specific unverified number/percentage/claim about the product's performance (e.g. a made-up "+300%" or "68cm→50cm") unless that exact figure was actually given in the product/brand context — some catalogue styles below (Before/After, Minimalist Infographic) naturally suggest number-driven phrasing, but a fabricated stat is a compliance risk, not just a style choice; write a punchy line without a specific invented number instead.`;

// Used only in "auto" mode, alongside HOOK_TEXT_RULES — real XHS "大字报"
// covers almost always pair a bold short headline with a softer second
// line, not one flat line of text, which is what the previous single-
// hookText-only rendering produced.
const AUTO_HEADLINE_SUBTITLE_RULES = `hookText is the bold, big-character HEADLINE — one short punchy line, roughly 3-8 characters if Chinese, 2-5 words if English (shorter than a standalone hook line would be; the subtitle below carries the supporting detail, so the headline itself should be the single sharpest hook, not the whole message). ${HOOK_TEXT_RULES}

subtitle: a smaller supporting line underneath the headline, roughly 6-16 characters if Chinese, 4-10 words if English — pairs with the headline the way real XHS "大字报"-style covers do (e.g. headline "深夜解压仪式" + subtitle "一滴精油，治愈一整天"). Write one that elaborates, softens, or adds a concrete supporting detail to the headline — never just repeat it in other words.`;

// The color-grade/mood (which of the 12 rendering "trend styles" in
// image-filter.ts) is derived from Claude's own coverStyleId pick via
// COVER_STYLE_TO_TREND_STYLE, not random anymore — but the COMPOSITION
// archetype (which of the 10 catalogue styles) genuinely benefits from
// Claude looking at the photo, unlike the old random trend-style approach
// which had no reasoning behind it at all.
const PHOTO_STYLING_SYSTEM_PROMPT_AUTO = `You are a XiaoHongShu content strategist looking at a customer's photo for a brand's post.

${COVER_STYLE_CATALOGUE}

First, deliberate across all 10 styles above and pick the 3 that fit THIS SPECIFIC photo best — consider lighting, subject, composition, and what story the image already tells. They must be 3 DISTINCT styles (never repeat one), ranked best-fit first. For each pick, write "coverStyleReason": one short sentence, specific to this photo, explaining why that style fits (not a generic description of the style itself).

${FACE_OVERLAP_RULE}

Then, for each of your 3 picks, write a headline+subtitle pair tailored to that specific style's own caption formula (e.g. a Before/After pick wants "[starting point] → [result]" framing; a Confessional/Story Hook pick wants a secret/reveal angle, not a plain description; a Bold Headline pick wants "[number] + [pain point] + [result]"; use the same logic for whichever styles you picked) — vary the angle/wording meaningfully across the 3, don't make them near-duplicates. For each option decide:

1. coverStyleId: the catalogue style number (1-10) this option uses.
2. coverStyleReason: as described above.
3. hookText and subtitle: overlaid directly on the photo (like real viral social covers do), together forming a big-headline + small-supporting-line pair — ${AUTO_HEADLINE_SUBTITLE_RULES} Punchy and curiosity-driven, matching the brand's tone and the picked style's formula, not a generic slogan.
4. If (and only if) coverStyleId is 5 (Confessional/Story Hook) or 9 (Real-Life/Lived-In Scene) for THIS option, ALSO write "paragraph": a short 2-4 line reflective, diary-style caption in the customer's own quiet, personal voice — gentle and unhurried, like a handwritten note to yourself, NOT a punchy ad hook or a call to action. Each line short (roughly 4-10 characters if Chinese, 3-7 words if English). Still fill in hookText/subtitle too as a fallback, but paragraph is what actually renders for these two styles. Omit "paragraph" entirely for any other coverStyleId.
5. ${LOGO_POSITION_RULE}

Write hookText, subtitle, paragraph, and coverStyleReason in the language given by "Output language" in the context, if present.

Respond with ONLY minified JSON, no markdown fences, in exactly this shape:
{"faceOverlap":{"top":false,"middle":true,"bottom":false},"leastBadPosition":"top","options":[{"coverStyleId":1,"coverStyleReason":"...","hookText":"...","subtitle":"...","logoPosition":"bottom-right"},{"coverStyleId":9,"coverStyleReason":"...","hookText":"...","subtitle":"...","paragraph":"...\\n...\\n...","logoPosition":"bottom-left"},{"coverStyleId":5,"coverStyleReason":"...","hookText":"...","subtitle":"...","paragraph":"...\\n...","logoPosition":"bottom-right"}]}`;

const PHOTO_STYLING_SYSTEM_PROMPT_CUSTOM = `You are a social media copywriter looking at a customer's photo for a brand's post. The customer already wrote their own caption text (given as "Customer's text" in the context) that they want overlaid on the photo — refine it into a punchy, scroll-stopping short line for a raster overlay, keeping their core meaning and language, just tightening the wording. ${HOOK_TEXT_RULES} If it's already short and punchy, keep it close to as-is rather than rewriting for the sake of it.

${FACE_OVERLAP_RULE}

Also decide: ${LOGO_POSITION_RULE}

Respond with ONLY minified JSON, no markdown fences, in exactly this shape:
{"hookText":"...","logoPosition":"bottom-right","faceOverlap":{"top":false,"middle":true,"bottom":false},"leastBadPosition":"top"}`;

const PHOTO_STYLING_SYSTEM_PROMPT_LOGO_ONLY = `You are looking at a customer's photo for a brand's post to decide where a small logo badge should sit so it doesn't cover the main subject. Decide: ${LOGO_POSITION_RULE}

Respond with ONLY minified JSON, no markdown fences, in exactly this shape:
{"logoPosition":"bottom-right"}`;

function buildTemplateStylingPlans(locale?: "en" | "zh"): PhotoStylingPlan[] {
  const isZh = locale !== "en";
  return [
    { hookText: isZh ? "这个真的绝了" : "You need this", logoPosition: "bottom-right", textPosition: "top" },
    { hookText: isZh ? "温柔小美好" : "Little moment", logoPosition: "bottom-left", textPosition: "middle" },
    { hookText: isZh ? "静静治愈中" : "So calming", logoPosition: "bottom-right", textPosition: "top" },
  ];
}

const ALL_TEXT_POSITIONS: TextPosition[] = ["top", "middle", "bottom"];

/**
 * Deterministically assigns `count` textPositions from the model's single
 * faceOverlap judgment, cycling through whichever bands are face-free
 * instead of trusting the model to re-decide (and stay consistent) 3
 * separate times — one per hookText option.
 */
function resolveTextPositions(parsed: Record<string, unknown> | null, count: number): TextPosition[] {
  const faceOverlapRaw = (parsed?.faceOverlap ?? {}) as Record<string, unknown>;
  const faceOverlap: Record<TextPosition, boolean> = {
    top: faceOverlapRaw.top === true,
    middle: faceOverlapRaw.middle === true,
    bottom: faceOverlapRaw.bottom === true,
  };
  const safePositions = ALL_TEXT_POSITIONS.filter((p) => !faceOverlap[p]);
  const leastBad: TextPosition = ALL_TEXT_POSITIONS.includes(parsed?.leastBadPosition as TextPosition)
    ? (parsed!.leastBadPosition as TextPosition)
    : "top";
  const fallback = safePositions.length > 0 ? safePositions : [leastBad];
  return Array.from({ length: count }, (_, i) => fallback[i % fallback.length]);
}

function buildImageUserContent(
  imageBase64: string,
  imageMediaType: string,
  extraLines: (string | null | undefined | false)[],
): Anthropic.MessageParam["content"] {
  return [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: imageMediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: imageBase64,
      },
    },
    { type: "text", text: extraLines.filter(Boolean).join("\n") || "No additional brand context given." },
  ];
}

/**
 * Looks at a photo and, depending on textMode, either invents 3 distinct
 * hook-text options (auto), polishes the customer's own text into one
 * placement-aware plan (custom), or just decides logo placement (none — no
 * hookText at all, fastest path, skips the copywriting call entirely if
 * there's also no logo to place, handled by the caller).
 */
export async function analyzePhotoForStyling(input: {
  imageBase64: string;
  imageMediaType: string;
  brandName?: string;
  productDescription?: string;
  locale?: "en" | "zh";
  textMode?: TextMode;
  customText?: string;
  needsLogoPosition?: boolean;
}): Promise<PhotoStylingPlan[]> {
  const textMode = input.textMode ?? "auto";

  // Used both when no key is configured at all, and when the API is
  // reachable but out of credit mid-request (see catch block below) — the
  // actual photo rendering (color grade, logo, text overlay) happens
  // locally via sharp regardless, so this still produces a genuinely
  // styled photo, just with a generic (non-photo-specific) hook line
  // instead of an AI-reasoned one, until the key has credit again.
  function templateFallback(): PhotoStylingPlan[] {
    if (textMode === "auto") return buildTemplateStylingPlans(input.locale);
    const fallback = buildTemplateStylingPlans(input.locale)[0];
    return [
      textMode === "custom"
        ? { ...fallback, hookText: sanitizeHookText(input.customText ?? fallback.hookText) }
        : { ...fallback, hookText: "" },
    ];
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return templateFallback();
  }

  try {
    return await analyzePhotoForStylingViaAi(input, textMode);
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return templateFallback();
    }
    throw err;
  }
}

async function analyzePhotoForStylingViaAi(
  input: {
    imageBase64: string;
    imageMediaType: string;
    brandName?: string;
    productDescription?: string;
    locale?: "en" | "zh";
    textMode?: TextMode;
    customText?: string;
    needsLogoPosition?: boolean;
  },
  textMode: TextMode,
): Promise<PhotoStylingPlan[]> {
  const baseLines = [
    input.locale
      ? `Output language: ${input.locale === "zh" ? "Chinese (Simplified)" : "English"}`
      : null,
    input.brandName ? `Brand/product name: ${input.brandName}` : null,
    input.productDescription ? `Product/brand description: ${input.productDescription}` : null,
  ];

  const validLogoPositions: LogoPosition[] = ["bottom-left", "bottom-right"];

  if (textMode === "none") {
    if (!input.needsLogoPosition) {
      return [{ hookText: "", logoPosition: "bottom-right", textPosition: "top" }];
    }
    const response = await createMessage({
      model: MODEL,
      max_tokens: 512,
      system: PHOTO_STYLING_SYSTEM_PROMPT_LOGO_ONLY,
      messages: [{ role: "user", content: buildImageUserContent(input.imageBase64, input.imageMediaType, baseLines) }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const parsed = parseModelJson(raw);
    const logoPosition = validLogoPositions.includes(parsed?.logoPosition as LogoPosition)
      ? (parsed!.logoPosition as LogoPosition)
      : "bottom-right";
    return [{ hookText: "", logoPosition, textPosition: "top" }];
  }

  if (textMode === "custom") {
    const customText = (input.customText ?? "").trim();
    if (!customText) return [{ hookText: "", logoPosition: "bottom-right", textPosition: "top" }];

    const response = await createMessage({
      model: MODEL,
      max_tokens: 1024,
      system: PHOTO_STYLING_SYSTEM_PROMPT_CUSTOM,
      messages: [
        {
          role: "user",
          content: buildImageUserContent(input.imageBase64, input.imageMediaType, [
            ...baseLines,
            `Customer's text: ${customText}`,
          ]),
        },
      ],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const parsed = parseModelJson(raw);
    const hookText = typeof parsed?.hookText === "string" ? sanitizeHookText(parsed.hookText) : "";
    const logoPosition = validLogoPositions.includes(parsed?.logoPosition as LogoPosition)
      ? (parsed!.logoPosition as LogoPosition)
      : "bottom-right";
    const [textPosition] = resolveTextPositions(parsed, 1);
    return [{ hookText: hookText || sanitizeHookText(customText), logoPosition, textPosition }];
  }

  // textMode === "auto"
  const response = await createMessage({
    model: MODEL,
    max_tokens: 2048,
    system: PHOTO_STYLING_SYSTEM_PROMPT_AUTO,
    messages: [{ role: "user", content: buildImageUserContent(input.imageBase64, input.imageMediaType, baseLines) }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

  const parsed = parseModelJson(raw);
  const rawOptions = Array.isArray(parsed?.options) ? (parsed.options as Record<string, unknown>[]) : [];
  const validOptions = rawOptions.filter(
    (o) =>
      typeof o.hookText === "string" &&
      (o.hookText as string).trim() &&
      validLogoPositions.includes(o.logoPosition as LogoPosition),
  );
  const textPositions = resolveTextPositions(parsed, validOptions.length);
  // Dedupe by coverStyleId in case the model repeats one despite the
  // distinct-picks instruction — keeps the 3 shown options genuinely
  // different, same reasoning as the old random trend-style assignment.
  const seenStyleIds = new Set<number>();
  const plans = validOptions
    .map((o, i) => {
      const rawId = typeof o.coverStyleId === "number" ? o.coverStyleId : Number(o.coverStyleId);
      const coverStyleId = Number.isInteger(rawId) && COVER_STYLE_NAMES[rawId] ? rawId : undefined;
      const subtitle =
        typeof o.subtitle === "string" && o.subtitle.trim() ? sanitizeHookText(o.subtitle) : undefined;
      // Only meaningful for coverStyleId 5/9 — see AUTO_HEADLINE_SUBTITLE_RULES
      // usage note above. sanitizeHookText only trims/strips emoji, so the
      // paragraph's own line breaks survive intact.
      const paragraph =
        typeof o.paragraph === "string" && o.paragraph.trim() ? sanitizeHookText(o.paragraph) : undefined;
      return {
        hookText: sanitizeHookText(o.hookText as string),
        subtitle,
        paragraph,
        logoPosition: o.logoPosition as LogoPosition,
        textPosition: textPositions[i],
        coverStyleId,
        coverStyleReason: typeof o.coverStyleReason === "string" ? o.coverStyleReason.trim() : undefined,
      };
    })
    .filter((o) => o.hookText.length > 0)
    .filter((o) => {
      if (o.coverStyleId === undefined) return true;
      if (seenStyleIds.has(o.coverStyleId)) return false;
      seenStyleIds.add(o.coverStyleId);
      return true;
    });

  return plans.length > 0 ? plans.slice(0, 3) : buildTemplateStylingPlans(input.locale);
}
