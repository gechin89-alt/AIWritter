import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type GenerateInput = {
  platform: "XHS" | "INSTAGRAM";
  identity?: string;
  tone?: string;
  style?: string;
  freeText?: string;
  commercial?: boolean;
  brandName?: string;
  imageBase64?: string;
  imageMediaType?: string;
  history?: ChatTurn[];
};

export type GenerateResult =
  | { type: "question"; content: string }
  | { type: "result"; content: string };

const SYSTEM_PROMPT = `You help everyday users draft social media posts for Xiaohongshu (小红书/XHS) and Instagram, based on their own photos/videos and their own answers about identity, tone, and style.

Rules:
- Write like a genuine customer telling a friend about their own experience — never like an advertisement or press release. Favor a real anecdote or specific small detail over generic praise ("好用" / "推荐" alone is weak; a concrete moment or observation is strong).
- Open with a short curiosity hook (a question, a surprising detail, or a relatable moment) rather than announcing the topic outright — the kind of first line that makes someone stop scrolling.
- Write in the platform's native conventions (XHS: casual, emoji-friendly, short paragraphs, relevant hashtags; Instagram: caption + hashtag block).
- Match the requested identity/persona, tone of voice, and style exactly.
- Stay authentic to what the user described. Never invent specific factual claims (prices, ingredients, medical/health claims) that weren't provided.
- If this is a commercial/sponsored post (commercial=true) and a brand/product name is given, mention that name naturally in the post the way a genuine customer would (e.g. "在<brand>试了..."), not as a bolted-on tag. Also include an appropriate disclosure per platform norms (e.g. "#合作" / "#广告" for XHS, "#ad" / "Paid partnership" for Instagram) — do not try to hide that it's sponsored.
- If the user's free-text input and answers are too vague or contradictory to write a good post (e.g. no topic at all), do NOT guess — instead ask ONE short clarifying question.
- Respond with ONLY minified JSON, no markdown fences, in exactly this shape:
  {"type":"question","content":"..."} when you need to ask something, or
  {"type":"result","content":"..."} when you are producing the final post text.`;

function buildTemplateContent(input: GenerateInput): string {
  const isXhs = input.platform !== "INSTAGRAM";
  const opener = input.freeText?.trim() || "分享一下今天的小体验～";
  const lines = [opener];

  if (input.identity || input.tone || input.style) {
    lines.push(
      [
        input.identity && `身份：${input.identity}`,
        input.tone && `语气：${input.tone}`,
        input.style && `风格：${input.style}`,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }

  if (input.commercial && input.brandName) {
    lines.push(`（在 ${input.brandName} 的体验）`);
  }

  const hashtags = isXhs ? ["#生活分享", "#种草"] : ["#lifestyle", "#sharing"];
  if (input.commercial) hashtags.push(isXhs ? "#合作" : "#ad");

  lines.push(hashtags.join(" "));
  lines.push(
    "\n⚠️ 这是演示文案（未配置 ANTHROPIC_API_KEY，非真实 AI 生成）。设置好密钥后会自动切换为真实生成。",
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
    input.identity ? `Identity/persona: ${input.identity}` : null,
    input.tone ? `Tone of voice: ${input.tone}` : null,
    input.style ? `Style: ${input.style}` : null,
    input.freeText ? `User's notes: ${input.freeText}` : null,
    input.commercial ? `This is a commercial/sponsored post.` : null,
    input.commercial && input.brandName
      ? `Brand/product name to mention naturally: ${input.brandName}`
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

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

  try {
    const parsed = JSON.parse(raw);
    if (parsed.type === "question" || parsed.type === "result") {
      return parsed;
    }
  } catch {
    // fall through
  }

  return { type: "result", content: raw };
}
