"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { ChoiceGroupWithOther } from "./choice-group-with-other";
import { MediaUploadField } from "./media-upload-field";
import { Modal } from "./modal";
import { toDownloadUrl } from "@/lib/download-url";
import { compressImageForUpload } from "@/lib/compress-image";

type FollowUpQuestion = { question: string; options: string[] };
type ChatTurn = { role: "user" | "assistant"; content: string };
type TextMode = "auto" | "custom" | "none";

// Temporary free/AI-less beautify playground — hidden for now per request,
// code kept intact so it can be switched back on later.
const SHOW_BEAUTIFY_TEST_PANEL = false;

const DEFAULT_EDIT_LIMIT = 3;

// Loose on purpose: customers may be from different countries and type
// spaces/dashes/a leading "+", so this only rejects obviously-wrong input
// (letters, way too short/long) rather than enforcing one country's format.
function isValidPhone(value: string): boolean {
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export function CommercialFlow({
  campaignSlug,
  questionMode = "FIXED",
  identityOptions: customIdentityOptions,
  toneOptions: customToneOptions,
  styleOptions: customStyleOptions,
  identityQuestion,
  toneQuestion,
  styleQuestion,
  identityIncludeOther,
  toneIncludeOther,
  styleIncludeOther,
  identityMultiSelect,
  toneMultiSelect,
  styleMultiSelect,
  resumeSubmissionId,
  accountName,
  accountPhone,
}: {
  campaignSlug: string;
  questionMode?: "FIXED" | "AI_ADAPTIVE";
  identityOptions?: string[];
  toneOptions?: string[];
  styleOptions?: string[];
  identityQuestion?: string;
  toneQuestion?: string;
  styleQuestion?: string;
  identityIncludeOther?: boolean;
  toneIncludeOther?: boolean;
  styleIncludeOther?: boolean;
  identityMultiSelect?: boolean;
  toneMultiSelect?: boolean;
  styleMultiSelect?: boolean;
  /** From a "?resume=<id>" link (e.g. sent by customer service) — jumps
   * straight to the result/submit-link screen for an existing draft instead
   * of starting the whole photo+questions flow over. */
  resumeSubmissionId?: string;
  /** Set when the visitor is logged into an account (e.g. they also use the
   * individual/self-serve flow) — pre-fills the contact step instead of
   * asking again, since it's tied to a real authenticated account rather
   * than a shared device. Anonymous visitors (the common case, scanned from
   * a campaign QR code) still get the plain manual fields. */
  accountName?: string;
  accountPhone?: string;
}) {
  const t = useTranslations("individual");
  const tc = useTranslations("commercial");
  const locale = useLocale();

  const identityOptions = customIdentityOptions ?? (tc.raw("identityOptions") as string[]);
  const toneOptions = customToneOptions ?? (tc.raw("toneOptions") as string[]);
  const styleOptions = customStyleOptions ?? (tc.raw("styleOptions") as string[]);
  const categoryOptions = tc.raw("categoryOptions") as string[];
  const otherLabel = tc("otherOption");
  const identityOtherLabel = identityIncludeOther ? otherLabel : undefined;
  const toneOtherLabel = toneIncludeOther ? otherLabel : undefined;
  const styleOtherLabel = styleIncludeOther ? otherLabel : undefined;

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPath, setMediaPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [styledPhotoPath, setStyledPhotoPath] = useState<string | null>(null);
  const [photoVariants, setPhotoVariants] = useState<string[]>([]);
  const [previewingVariant, setPreviewingVariant] = useState<string | null>(null);
  const [stylingPhoto, setStylingPhoto] = useState(false);
  // Defaults to "auto" so uploading a photo with no extra taps just works;
  // removing the photo resets this so the choice is asked fresh for
  // whatever gets uploaded next.
  const [textModeChoice, setTextModeChoice] = useState<TextMode>("auto");
  const [customText, setCustomText] = useState("");

  // TEMPORARY: free, AI-less test button for tuning the base beautify look
  // in isolation, before the filter/logo pipeline. Remove once done testing.
  const [beautifyTestPath, setBeautifyTestPath] = useState<string | null>(null);
  const [beautifyTesting, setBeautifyTesting] = useState(false);
  const [beautifyStyle, setBeautifyStyle] = useState<
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
    | "forestGreen"
  >("goldenHour");
  const [beautifyCaption, setBeautifyCaption] = useState("");
  const [beautifyPolaroid, setBeautifyPolaroid] = useState(false);
  const [beautifyDetailRestore, setBeautifyDetailRestore] = useState(false);

  const [identity, setIdentity] = useState("");
  const [tone, setTone] = useState("");
  const [style, setStyle] = useState("");
  const [freeText, setFreeText] = useState("");
  // Commercial campaigns only make sense on XHS: the lucky-draw submission
  // step below only accepts an XHS post link, so posts here always target XHS.
  const platform = "XHS" as const;

  // AI-adaptive mode state
  const [category, setCategory] = useState("");
  const [questionsFetched, setQuestionsFetched] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<string[]>([]);
  const [followUpIndex, setFollowUpIndex] = useState(0);

  const [result, setResult] = useState<string | null>(null);
  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [chosenTitle, setChosenTitle] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<{ content: string; suggestReupload?: boolean } | null>(
    null,
  );
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const [name, setName] = useState(accountName ?? "");
  const [phone, setPhone] = useState(accountPhone ?? "");
  const [xhsLink, setXhsLink] = useState("");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Stage 0: contact info (name+phone) comes first now, before any Q&A or
  // photo — so we can look the phone up (fairness: one entry per campaign)
  // before the customer invests time answering questions.
  const [contactConfirmed, setContactConfirmed] = useState(false);
  const [checkingContact, setCheckingContact] = useState(false);
  // Set when this phone has already POSTED for this campaign — blocks
  // re-entry entirely instead of allowing a second lucky-draw entry.
  const [blockedSubmission, setBlockedSubmission] = useState<{
    generatedContent: string | null;
    mediaPath: string | null;
    xhsLink: string | null;
  } | null>(null);
  const [editCount, setEditCount] = useState(0);
  const [editLimit, setEditLimit] = useState(DEFAULT_EDIT_LIMIT);

  // Stage 2->3 gate: content (the written post) is reviewed/regenerated
  // before moving on to the photo step.
  const [contentStepConfirmed, setContentStepConfirmed] = useState(false);
  // Stage 3->final gate: photo upload+beautify, now the LAST step before
  // submission instead of the first — the written feedback shouldn't be
  // limited by what's visible in a specific photo.
  const [photoStepConfirmed, setPhotoStepConfirmed] = useState(false);

  // Once 3 AI-styled variants come back, block progress until the customer
  // taps one — otherwise they could continue using the un-styled raw photo
  // without ever seeing the styled options. Declared here (before any early
  // `return`) since the photo-step return further down needs it, and const
  // declarations aren't hoisted the way function declarations are.
  const photoSelectionPending = photoVariants.length > 0 && !styledPhotoPath;

  const mediaField = (
    <div>
      {!styledPhotoPath && !stylingPhoto && photoVariants.length === 0 && (
        <div className="mb-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{tc("chooseTextMode")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTextModeChoice("auto");
                if (mediaFile) runPhotoStyling(mediaFile, "auto");
              }}
              className={
                textModeChoice === "auto"
                  ? "rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-brand/50 dark:border-zinc-700 dark:text-zinc-400"
              }
            >
              {tc("textModeAuto")}
            </button>
            <button
              type="button"
              onClick={() => setTextModeChoice("custom")}
              className={
                textModeChoice === "custom"
                  ? "rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-brand/50 dark:border-zinc-700 dark:text-zinc-400"
              }
            >
              {tc("textModeCustom")}
            </button>
            <button
              type="button"
              onClick={() => {
                setTextModeChoice("none");
                if (mediaFile) runPhotoStyling(mediaFile, "none");
              }}
              className={
                textModeChoice === "none"
                  ? "rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-brand/50 dark:border-zinc-700 dark:text-zinc-400"
              }
            >
              {tc("textModeNone")}
            </button>
          </div>
          {textModeChoice === "custom" && (
            <div className="mt-2 flex gap-2">
              <input
                value={customText}
                onChange={(e) => setCustomText(e.target.value.slice(0, 30))}
                placeholder={tc("customTextPlaceholder")}
                maxLength={30}
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              {mediaFile && (
                <button
                  type="button"
                  onClick={() => runPhotoStyling(mediaFile, "custom", customText)}
                  disabled={!customText.trim()}
                  className="rounded-full bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  {tc("confirmTextMode")}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <MediaUploadField
        label={tc("stepMedia")}
        file={mediaFile}
        onChange={handleMediaSelected}
        accept="image/*"
        uploadLabel={tc("uploadCta")}
        removeLabel={tc("removePhoto")}
        disableRemove={stylingPhoto}
      />

      {stylingPhoto && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {tc("stylingPhoto")}
        </p>
      )}
      {photoVariants.length > 1 && !styledPhotoPath && !stylingPhoto && (
        <div className="mt-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{tc("choosePhotoVariant")}</p>
          {/* grid instead of a fixed-width flex row — 3 fixed 96px thumbnails
              (plus gaps) can be wider than a narrow phone screen, pushing
              them off-screen with no visible scrollbar, so they looked like
              they never rendered at all. A 3-column grid always fits. */}
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photoVariants.map((variantPath) => (
              <button
                key={variantPath}
                type="button"
                onClick={() => setPreviewingVariant(variantPath)}
                className="aspect-square overflow-hidden rounded-lg border-2 border-transparent hover:border-brand"
              >
                <Image
                  src={variantPath}
                  alt=""
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <Modal open={previewingVariant !== null} onClose={() => setPreviewingVariant(null)}>
        {previewingVariant && (
          <div className="flex flex-col items-center gap-3">
            <Image
              src={previewingVariant}
              alt=""
              width={480}
              height={480}
              className="max-h-[70vh] w-auto rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={() => {
                handleChoosePhotoVariant(previewingVariant);
                setPreviewingVariant(null);
              }}
              className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
            >
              {tc("chooseThisPhoto")}
            </button>
          </div>
        )}
      </Modal>
      {styledPhotoPath && !stylingPhoto && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-brand/30 bg-brand/5 p-3">
          <Image
            src={styledPhotoPath}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-md object-cover"
          />
          <div className="flex flex-col gap-1">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {tc("styledPhotoReady")}
            </p>
            <a
              href={toDownloadUrl(styledPhotoPath)}
              download
              className="text-xs font-medium text-brand underline"
            >
              {tc("downloadStyledPhoto")}
            </a>
          </div>
        </div>
      )}

      {SHOW_BEAUTIFY_TEST_PANEL && mediaPath && (
        <div className="mt-3 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            🧪 临时测试：只测美化效果，不含滤镜/Logo，不产生 AI 费用
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                { key: "goldenHour", label: "🌅 黄金时刻" },
                { key: "kodakPortra", label: "📷 柯达胶片" },
                { key: "cinematic", label: "🎬 电影感" },
                { key: "dreamySoft", label: "☁️ 梦幻柔光" },
                { key: "quietLuxury", label: "👑 高级质感" },
                { key: "vintageFilm", label: "🎞️ 复古胶片" },
                { key: "earthTone", label: "🌿 大地色" },
                { key: "brightClean", label: "🇰🇷 清透白皙" },
                { key: "tiktokViral", label: "📱 网红爆款" },
                { key: "mochaBrown", label: "🍫 摩卡棕" },
                { key: "creamyBeige", label: "🥛 奶油白" },
                { key: "forestGreen", label: "🌲 森林绿" },
              ] as const
            ).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setBeautifyStyle(s.key)}
                className={
                  beautifyStyle === s.key
                    ? "rounded-full bg-brand px-3 py-1 text-xs font-medium text-white"
                    : "rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={beautifyPolaroid}
              onChange={(e) => setBeautifyPolaroid(e.target.checked)}
            />
            拍立得相框
          </label>
          <label className="mt-1 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={beautifyDetailRestore}
              onChange={(e) => setBeautifyDetailRestore(e.target.checked)}
            />
            AI 细节修复（较慢，几秒钟）
          </label>
          <input
            value={beautifyCaption}
            onChange={(e) => setBeautifyCaption(e.target.value)}
            placeholder="图上文字/emoji（可留空）"
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="button"
            onClick={handleBeautifyTest}
            disabled={beautifyTesting}
            className="mt-2 rounded-full bg-zinc-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900"
          >
            {beautifyTesting ? "处理中..." : "测试美化效果"}
          </button>
          {beautifyTestPath && (
            <div className="mt-3">
              <Image
                src={beautifyTestPath}
                alt=""
                width={200}
                height={200}
                className="max-h-64 w-auto rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  // A "?resume=<id>" link (e.g. sent by customer service to someone who
  // generated a post but never submitted their XHS link) jumps straight to
  // wherever they left off instead of starting the whole flow over.
  useEffect(() => {
    if (!resumeSubmissionId) return;
    fetch(`/api/submissions/${resumeSubmissionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setSubmissionId(data.id);
        setName(data.name ?? "");
        setPhone(data.phone ?? "");
        setMediaPath(data.mediaPath ?? null);
        setPhotoVariants(data.photoVariants ?? []);
        setResult(data.generatedContent ?? null);
        setTitleOptions(data.titleVariants ?? []);
        setChosenTitle(data.chosenTitle ?? data.titleVariants?.[0] ?? null);
        setEditCount(data.editCount ?? 0);
        setEditLimit(data.editLimit ?? DEFAULT_EDIT_LIMIT);
        if (data.xhsLink) setXhsLink(data.xhsLink);
        setContactConfirmed(true);
        if (data.generatedContent) {
          setContentStepConfirmed(true);
          if (data.mediaPath) setPhotoStepConfirmed(true);
        }
      })
      .catch(() => {
        // Silent — worst case the customer just starts the normal flow instead.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeSubmissionId]);

  async function uploadFile(file: File): Promise<string | undefined> {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        // Surface the real reason (e.g. "Unsupported file type", "File too
        // large") instead of a generic message, so a failure is actionable
        // from what the customer sees on screen alone, no devtools needed.
        const body = await res.json().catch(() => null);
        throw new Error(`upload_failed:${res.status}:${body?.error ?? "unknown"}`);
      }
      const data = await res.json();
      setMediaPath(data.path);
      return data.path as string;
    } finally {
      setUploading(false);
    }
  }

  async function uploadMediaIfNeeded(): Promise<string | undefined> {
    if (!mediaFile) return undefined;
    if (mediaPath) return mediaPath;
    return uploadFile(mediaFile);
  }

  async function handleMediaSelected(file: File | null) {
    setMediaPath(null);
    setStyledPhotoPath(null);
    setPhotoVariants([]);
    if (!file) {
      setMediaFile(null);
      // Removing the photo resets the text-mode question so it's asked
      // fresh for whatever gets uploaded next.
      setTextModeChoice("auto");
      setCustomText("");
      return;
    }
    // Fresh phone-camera photos (especially iPhone) can be several MB and
    // exceed Netlify's serverless function payload limit before our own
    // code even runs, showing up as an unexplained 500. Shrinking client-side
    // first sidesteps that regardless of the exact limit.
    const compressed = await compressImageForUpload(file);
    setMediaFile(compressed);
    // Defaults to "auto", so a fresh upload just works immediately unless
    // the customer had already picked "custom" and typed something.
    if (textModeChoice !== "custom" || customText.trim()) {
      runPhotoStyling(compressed, textModeChoice, customText);
    }
  }

  async function runPhotoStyling(file: File, mode: TextMode, text?: string) {
    setTextModeChoice(mode);
    setStyledPhotoPath(null);
    setPhotoVariants([]);
    setStylingPhoto(true);
    setError(null);
    try {
      const resolvedPath = mediaPath ?? (await uploadFile(file));
      if (!resolvedPath) {
        setError(tc("errorGeneric"));
        return;
      }
      const filterRes = await fetch("/api/photo-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaPath: resolvedPath, campaignSlug, locale, textMode: mode, customText: text }),
      });
      if (filterRes.ok) {
        const filterData = await filterRes.json();
        const variants: string[] = filterData.variants ?? [];
        if (filterData.filtered && variants.length > 1) {
          // Let the customer pick their favorite of the 3 AI-styled options.
          setPhotoVariants(variants);
        } else if (filterData.filtered && variants.length === 1) {
          setStyledPhotoPath(variants[0]);
        }
        // filtered:false with no error is a legitimate no-op (e.g. campaign
        // has no brand color/logo configured) - mediaPath alone still works.
      } else {
        setError(tc("errorGeneric"));
      }
    } catch (err) {
      // Previously uncaught here — on a slow/dropped mobile connection this
      // silently reset stylingPhoto with no variants and no visible error,
      // looking exactly like "the 3 photos just never show up". Appending
      // the raw reason lets this get diagnosed from what the customer sees
      // on screen alone, no devtools needed.
      const message = err instanceof Error ? err.message : String(err);
      setError(`${tc("errorGeneric")} (${message})`);
    } finally {
      setStylingPhoto(false);
    }
  }

  function handleChoosePhotoVariant(path: string) {
    setStyledPhotoPath(path);
  }

  async function handleBeautifyTest() {
    if (!mediaPath) return;
    setBeautifyTesting(true);
    try {
      const res = await fetch("/api/photo-beautify-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaPath,
          trendStyle: beautifyStyle,
          captionText: beautifyCaption,
          polaroid: beautifyPolaroid,
          detailRestore: beautifyDetailRestore,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.filtered) setBeautifyTestPath(data.path as string);
      }
    } finally {
      setBeautifyTesting(false);
    }
  }

  async function handleContactContinue() {
    if (!name.trim() || !isValidPhone(phone)) return;
    setCheckingContact(true);
    setError(null);
    try {
      const res = await fetch("/api/submissions/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignSlug, name, phone }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      if (data.status === "blocked") {
        setBlockedSubmission(data.submission);
        return;
      }
      setSubmissionId(data.submission.id);
      setEditCount(data.submission.editCount ?? 0);
      setEditLimit(data.submission.editLimit ?? DEFAULT_EDIT_LIMIT);
      if (data.status === "resume") {
        setMediaPath(data.submission.mediaPath ?? null);
        setPhotoVariants(data.submission.photoVariants ?? []);
        setResult(data.submission.generatedContent ?? null);
        setTitleOptions(data.submission.titleVariants ?? []);
        setChosenTitle(data.submission.chosenTitle ?? data.submission.titleVariants?.[0] ?? null);
        if (data.submission.generatedContent) {
          setContentStepConfirmed(true);
          if (data.submission.mediaPath) setPhotoStepConfirmed(true);
        }
      }
      setContactConfirmed(true);
    } catch {
      setError(tc("errorGeneric"));
    } finally {
      setCheckingContact(false);
    }
  }

  async function handleFetchQuestions() {
    setLoadingQuestions(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, campaignSlug }),
      });
      if (res.status === 503) {
        setAiUnavailable(true);
        setError(tc("aiUnavailable"));
        return;
      }
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      const questions: FollowUpQuestion[] = data.questions ?? [];
      setFollowUpQuestions(questions);
      setFollowUpAnswers(new Array(questions.length).fill(""));
      setFollowUpIndex(0);
      setQuestionsFetched(true);
    } catch {
      setError(tc("errorGeneric"));
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function callGenerate(nextHistory: ChatTurn[], opts?: { isRegenerate?: boolean }) {
    setLoading(true);
    setError(null);
    try {
      const isAdaptive = questionMode === "AI_ADAPTIVE";
      const qaPairs = isAdaptive
        ? followUpQuestions.map((q, i) => ({
            question: q.question,
            answer: followUpAnswers[i] ?? "",
          }))
        : undefined;
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          identity: isAdaptive ? undefined : identity,
          tone: isAdaptive ? undefined : tone,
          style: isAdaptive ? undefined : style,
          category: isAdaptive ? category : undefined,
          qaPairs,
          freeText,
          commercial: true,
          campaignSlug,
          // No photo yet at this point in the flow — content generation is
          // about the customer's own feedback/experience, not tied to
          // whatever they'll upload afterward.
          history: nextHistory,
          locale,
          submissionId,
          isRegenerate: opts?.isRegenerate ?? false,
        }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => null);
        setEditCount(data?.editCount ?? editLimit);
        setError(tc("editLimitReachedHint"));
        return;
      }
      if (res.status === 503) {
        setAiUnavailable(true);
        setError(tc("aiUnavailable"));
        return;
      }
      if (!res.ok) throw new Error("generate failed");
      const data = await res.json();
      if (typeof data.editCount === "number") setEditCount(data.editCount);
      if (typeof data.editLimit === "number") setEditLimit(data.editLimit);
      if (data.type === "question") {
        setPendingQuestion({ content: data.content, suggestReupload: data.suggestReupload });
        setHistory([...nextHistory, { role: "assistant", content: data.content }]);
      } else {
        setPendingQuestion(null);
        setResult(data.content);
        setTitleOptions(data.titles ?? []);
        setChosenTitle(data.titles?.[0] ?? null);
      }
    } catch {
      setError(tc("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setHistory([]);
    await callGenerate([]);
  }

  async function handleRegenerate() {
    if (editCount >= editLimit) return;
    setHistory([]);
    await callGenerate([], { isRegenerate: true });
  }

  async function handleClarifySubmit() {
    if (!clarifyAnswer.trim()) return;
    const nextHistory: ChatTurn[] = [...history, { role: "user", content: clarifyAnswer }];
    setClarifyAnswer("");
    await callGenerate(nextHistory);
  }

  function handleReupload() {
    setPendingQuestion(null);
    setHistory([]);
    setClarifyAnswer("");
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Saves progress as soon as there's something worth saving (content
  // generated, and later the photo/title choice) so admin can see + follow
  // up with people who generated a post but never came back with a link.
  async function handleSaveDraft() {
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          campaignSlug,
          name,
          phone,
          mediaPath: styledPhotoPath ?? mediaPath,
          photoVariants,
          generatedContent: result,
          titleVariants: titleOptions,
          chosenTitle,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setSubmissionId(data.id ?? null);
    } catch {
      // Silent — this is a background convenience save, not a user action.
    }
  }

  useEffect(() => {
    if (result) {
      handleSaveDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, styledPhotoPath, chosenTitle]);

  async function handleSubmitLink() {
    if (!name.trim() || !phone.trim() || !xhsLink.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          campaignSlug,
          name,
          phone,
          mediaPath: styledPhotoPath ?? mediaPath,
          photoVariants,
          generatedContent: result,
          titleVariants: titleOptions,
          chosenTitle,
          xhsLink,
        }),
      });
      if (res.status === 409) {
        setError(tc("alreadySubmittedHint"));
        return;
      }
      if (!res.ok) throw new Error("submit failed");
      setSubmitted(true);
    } catch {
      setError(tc("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoToXHS() {
    // window.open must be the very first thing that happens, synchronously,
    // in direct response to the click — after any `await`, several browsers
    // (especially mobile) no longer treat it as a user-initiated action and
    // silently block the popup, leaving only the photo download visible and
    // making it look like the button did nothing for XHS at all.
    window.open("https://creator.xiaohongshu.com/publish/publish", "_blank");

    const photoPath = styledPhotoPath ?? mediaPath;
    if (photoPath) {
      const a = document.createElement("a");
      a.href = toDownloadUrl(photoPath);
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    if (result) {
      navigator.clipboard.writeText(result).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="rounded-lg bg-brand/10 p-4 text-sm text-brand">
          {tc("submitted")}
        </p>
      </div>
    );
  }

  if (blockedSubmission) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">{tc("alreadySubmittedTitle")}</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{tc("alreadySubmittedHint")}</p>
        {blockedSubmission.mediaPath && (
          <Image
            src={blockedSubmission.mediaPath}
            alt=""
            width={160}
            height={160}
            className="mt-4 h-40 w-40 rounded-lg border border-zinc-200 object-cover dark:border-zinc-800"
          />
        )}
        {blockedSubmission.xhsLink && (
          <a
            href={blockedSubmission.xhsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-sm text-brand underline"
          >
            {blockedSubmission.xhsLink}
          </a>
        )}
      </div>
    );
  }

  if (!contactConfirmed) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold">{tc("questionnaireTitle")}</h2>
        <div className="mt-6 flex flex-col gap-3">
          <label className="text-sm font-medium">
            {accountName ? tc("contactAccountLabel") : tc("contactRequiredLabel")}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tc("namePlaceholder")}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={tc("phonePlaceholder")}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          {phone.trim() && !isValidPhone(phone) && (
            <p className="text-xs text-red-600">{tc("invalidPhone")}</p>
          )}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{tc("oneEntryPerPhoneHint")}</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleContactContinue}
            disabled={checkingContact || !name.trim() || !isValidPhone(phone)}
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {checkingContact ? tc("loadingQuestions") : tc("continueLabel")}
          </button>
        </div>
      </div>
    );
  }

  if (pendingQuestion) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">{t("clarifyTitle")}</h2>
        {/* Chat-style thread: the whole back-and-forth so far renders as a
            growing conversation (received bubbles for the AI's questions,
            sent bubbles for the customer's replies), like a WeChat/WhatsApp
            chat, instead of replacing the last question each round. */}
        <div className="mt-4 flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {history.map((turn, i) => (
            <div key={i} className={`flex ${turn.role === "assistant" ? "justify-start" : "justify-end"}`}>
              <div
                className={
                  turn.role === "assistant"
                    ? "max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                    : "max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-sm text-white"
                }
              >
                {turn.content}
              </div>
            </div>
          ))}
        </div>

        {pendingQuestion.suggestReupload && (
          <button
            type="button"
            onClick={handleReupload}
            className="mt-3 rounded-full border border-brand px-4 py-2 text-xs font-medium text-brand hover:bg-brand/10"
          >
            {tc("reuploadPhoto")}
          </button>
        )}

        <textarea
          value={clarifyAnswer}
          onChange={(e) => setClarifyAnswer(e.target.value)}
          rows={2}
          placeholder={tc("chatReplyPlaceholder")}
          className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          onClick={handleClarifySubmit}
          disabled={loading || aiUnavailable || !clarifyAnswer.trim()}
          className={
            aiUnavailable
              ? "mt-3 rounded-full bg-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
              : "mt-3 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          }
        >
          {loading ? tc("sendingReply") : tc("sendReply")}
        </button>
      </div>
    );
  }

  // Stage 2: content is generated — review it, optionally regenerate (capped
  // at editLimit uses), then move on to the photo step.
  if (result && !contentStepConfirmed) {
    const editsRemaining = Math.max(0, editLimit - editCount);
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold">{tc("contentReviewTitle")}</h2>
        {titleOptions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{tc("chooseTitle")}</p>
            <div className="mt-2 flex flex-col gap-2">
              {titleOptions.map((title) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => setChosenTitle(title)}
                  className={
                    chosenTitle === title
                      ? "rounded-lg border-2 border-brand bg-brand/5 px-3 py-2 text-left text-sm font-medium text-brand"
                      : "rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm hover:border-brand/50 dark:border-zinc-800"
                  }
                >
                  {title}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          {result}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleRegenerate}
            disabled={loading || aiUnavailable || editCount >= editLimit}
            className="rounded-full border border-brand px-5 py-2.5 text-sm font-medium text-brand hover:bg-brand/10 disabled:opacity-50"
          >
            {loading ? tc("regenerating") : tc("regenerate")}
          </button>
          <button
            onClick={() => setContentStepConfirmed(true)}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            {tc("continueToPhoto")}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {editCount >= editLimit ? tc("editLimitReachedHint") : tc("editCountRemaining", { remaining: editsRemaining })}
        </p>
      </div>
    );
  }

  // Stage 3: photo upload + AI beautify — now the last step before the
  // final combined result, decoupled from the written content above.
  if (result && contentStepConfirmed && !photoStepConfirmed) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold">{tc("photoStepTitle")}</h2>
        <div className="mt-6 flex flex-col gap-5">
          {mediaField}

          {!mediaPath && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{tc("stepMediaRequiredHint")}</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => setPhotoStepConfirmed(true)}
            disabled={!mediaPath || photoSelectionPending || stylingPhoto || uploading}
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {tc("continueLabel")}
          </button>
        </div>
      </div>
    );
  }

  if (result && contentStepConfirmed && photoStepConfirmed) {
    const finalPhotoPath = styledPhotoPath ?? mediaPath;
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold">{t("result")}</h2>
        {finalPhotoPath && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <Image
              src={finalPhotoPath}
              alt=""
              width={240}
              height={240}
              className="max-h-72 w-auto rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
            />
            {styledPhotoPath && (
              <a
                href={toDownloadUrl(styledPhotoPath)}
                download
                className="text-xs font-medium text-brand underline"
              >
                {tc("downloadStyledPhoto")}
              </a>
            )}
          </div>
        )}
        <div className="mt-4 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          {result}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            {copied ? t("copied") : t("copy")}
          </button>
          <button
            onClick={handleGoToXHS}
            className="rounded-full border border-brand px-5 py-2.5 text-sm font-medium text-brand hover:bg-brand/10"
          >
            {tc("goToXHS")}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{tc("goToXHSHint")}</p>

        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">{tc("submitLink")}</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {tc("submitAsLabel", { name, phone })}
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <input
              value={xhsLink}
              onChange={(e) => setXhsLink(e.target.value)}
              placeholder={tc("linkPlaceholder")}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <p className="text-xs text-amber-600 dark:text-amber-400">{tc("invalidLinkVoidsEntryHint")}</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={handleSubmitLink}
              disabled={submitting}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {tc("submit")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (questionMode === "AI_ADAPTIVE" && !questionsFetched) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold">{tc("questionnaireTitle")}</h2>
        <div className="mt-6 flex flex-col gap-5">
          <div>
            <label className="text-sm font-medium">{tc("category")}</label>
            <div className="mt-2">
              <ChoiceGroupWithOther
                options={categoryOptions}
                otherLabel={otherLabel}
                otherPlaceholder={tc("otherPlaceholder")}
                value={category}
                onChange={setCategory}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleFetchQuestions}
            disabled={loadingQuestions || !category || aiUnavailable}
            className={
              aiUnavailable
                ? "mt-2 rounded-full bg-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                : "mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            }
          >
            {loadingQuestions ? tc("loadingQuestions") : tc("continueLabel")}
          </button>
        </div>
      </div>
    );
  }

  if (
    questionMode === "AI_ADAPTIVE" &&
    questionsFetched &&
    followUpIndex < followUpQuestions.length
  ) {
    const q = followUpQuestions[followUpIndex];
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold">{tc("questionnaireTitle")}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {/* Chat-style thread: every question already asked shows as a
              received bubble, with the customer's picked answer as a sent
              bubble right after it — reads like a conversation instead of a
              plain form, which is more inviting to actually engage with. */}
          {followUpQuestions.slice(0, followUpIndex + 1).map((histQ, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                  {histQ.question}
                </div>
              </div>
              {i < followUpIndex && followUpAnswers[i] && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-sm text-white">
                    {followUpAnswers[i]}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="mt-1">
            <ChoiceGroupWithOther
              options={q.options}
              otherLabel={otherLabel}
              otherPlaceholder={tc("otherPlaceholder")}
              value={followUpAnswers[followUpIndex] ?? ""}
              onChange={(value) => {
                const next = [...followUpAnswers];
                next[followUpIndex] = value;
                setFollowUpAnswers(next);
              }}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={() => setFollowUpIndex(followUpIndex + 1)}
            disabled={!followUpAnswers[followUpIndex]?.trim()}
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {tc("continueLabel")}
          </button>
        </div>
      </div>
    );
  }

  // Stage 1 (FIXED mode, or AI_ADAPTIVE once its follow-up questions are
  // answered): the written feedback itself — no photo involved at all.
  return (
    <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-xl font-semibold">{tc("questionnaireTitle")}</h2>
      <div className="mt-6 flex flex-col gap-5">
        {questionMode === "FIXED" && (
          <>
            <div>
              <label className="text-sm font-medium">
                {identityQuestion || tc("identity")}
              </label>
              <div className="mt-2">
                <ChoiceGroupWithOther
                  options={identityOptions}
                  otherLabel={identityOtherLabel}
                  otherPlaceholder={tc("otherPlaceholder")}
                  value={identity}
                  onChange={setIdentity}
                  multiple={identityMultiSelect}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">
                {toneQuestion || tc("tone")}
              </label>
              <div className="mt-2">
                <ChoiceGroupWithOther
                  options={toneOptions}
                  otherLabel={toneOtherLabel}
                  otherPlaceholder={tc("otherPlaceholder")}
                  value={tone}
                  onChange={setTone}
                  multiple={toneMultiSelect}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">
                {styleQuestion || tc("style")}
              </label>
              <div className="mt-2">
                <ChoiceGroupWithOther
                  options={styleOptions}
                  otherLabel={styleOtherLabel}
                  otherPlaceholder={tc("otherPlaceholder")}
                  value={style}
                  onChange={setStyle}
                  multiple={styleMultiSelect}
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="text-sm font-medium">{tc("freeText")}</label>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={tc("freeTextPlaceholder")}
            rows={3}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={loading || aiUnavailable}
          className={
            aiUnavailable
              ? "mt-2 rounded-full bg-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
              : "mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          }
        >
          {loading ? t("generating") : t("generate")}
        </button>
      </div>
    </div>
  );
}
