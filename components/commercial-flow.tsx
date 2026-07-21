"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { ChoiceGroupWithOther } from "./choice-group-with-other";
import { MediaUploadField } from "./media-upload-field";
import { Modal } from "./modal";

type FollowUpQuestion = { question: string; options: string[] };
type ChatTurn = { role: "user" | "assistant"; content: string };

// Temporary free/AI-less beautify playground — hidden for now per request,
// code kept intact so it can be switched back on later.
const SHOW_BEAUTIFY_TEST_PANEL = false;

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
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [clarifyAnswer, setClarifyAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [xhsLink, setXhsLink] = useState("");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entryCount, setEntryCount] = useState<number | null>(null);

  async function uploadMediaIfNeeded(): Promise<string | undefined> {
    if (!mediaFile) return undefined;
    if (mediaPath) return mediaPath;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", mediaFile);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("upload failed");
      const data = await res.json();
      setMediaPath(data.path);
      return data.path as string;
    } finally {
      setUploading(false);
    }
  }

  async function handleMediaSelected(file: File | null) {
    setMediaFile(file);
    setMediaPath(null);
    setStyledPhotoPath(null);
    setPhotoVariants([]);
    if (!file) return;

    setUploading(true);
    setStylingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) return;
      const uploadData = await uploadRes.json();
      const rawPath = uploadData.path as string;
      setMediaPath(rawPath);
      setUploading(false);

      const filterRes = await fetch("/api/photo-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaPath: rawPath, campaignSlug, locale }),
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
      }
    } finally {
      setUploading(false);
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

  async function handleFetchQuestions() {
    setLoadingQuestions(true);
    setError(null);
    try {
      const resolvedMediaPath = await uploadMediaIfNeeded();
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, mediaPath: resolvedMediaPath }),
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

  async function callGenerate(nextHistory: ChatTurn[], resolvedMediaPath?: string) {
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
          mediaPath: resolvedMediaPath ?? mediaPath ?? undefined,
          history: nextHistory,
          locale,
        }),
      });
      if (res.status === 503) {
        setAiUnavailable(true);
        setError(tc("aiUnavailable"));
        return;
      }
      if (!res.ok) throw new Error("generate failed");
      const data = await res.json();
      if (data.type === "question") {
        setPendingQuestion(data.content);
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
    if (!name.trim() || !phone.trim()) return;
    const resolvedMediaPath = await uploadMediaIfNeeded();
    await callGenerate([], resolvedMediaPath);
  }

  async function handleClarifySubmit() {
    if (!clarifyAnswer.trim()) return;
    const nextHistory: ChatTurn[] = [...history, { role: "user", content: clarifyAnswer }];
    setClarifyAnswer("");
    await callGenerate(nextHistory);
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Saves contact info as soon as it's available (before the customer has
  // necessarily posted anything yet) so admin can see + follow up with
  // people who generated a post but never came back with a link.
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

  // As soon as both a photo style and a title are chosen, save a draft right
  // away — even before the customer has scrolled down to give their name/
  // phone — so admin visibility into "generated but never posted" isn't
  // limited to people who got as far as the contact form.
  useEffect(() => {
    if (styledPhotoPath && chosenTitle) {
      handleSaveDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styledPhotoPath, chosenTitle]);

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
      if (!res.ok) throw new Error("submit failed");
      const data = await res.json();
      setEntryCount(data.entryCount ?? null);
      setSubmitted(true);
    } catch {
      setError(tc("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoToXHS() {
    const photoPath = styledPhotoPath ?? mediaPath;
    if (photoPath) {
      const a = document.createElement("a");
      a.href = photoPath;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    if (result) {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    // Official XHS creator web publish page — no login automation, the user
    // still uploads the (already-downloaded) photo and pastes the (already-
    // copied) caption themselves inside XHS's own compose screen.
    window.open("https://creator.xiaohongshu.com/publish/publish", "_blank");
  }

  function handlePostAnother() {
    setMediaFile(null);
    setMediaPath(null);
    setStyledPhotoPath(null);
    setPhotoVariants([]);
    setStylingPhoto(false);
    setTitleOptions([]);
    setChosenTitle(null);
    setIdentity("");
    setTone("");
    setStyle("");
    setFreeText("");
    setXhsLink("");
    setSubmissionId(null);
    setCategory("");
    setQuestionsFetched(false);
    setFollowUpQuestions([]);
    setFollowUpAnswers([]);
    setFollowUpIndex(0);
    setResult(null);
    setHistory([]);
    setPendingQuestion(null);
    setClarifyAnswer("");
    setSubmitted(false);
    setError(null);
    setAiUnavailable(false);
  }

  if (submitted) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="rounded-lg bg-brand/10 p-4 text-sm text-brand">
          {tc("submitted")}
        </p>
        {entryCount !== null && (
          <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {tc("entryCount", { count: entryCount })}
          </p>
        )}
        <button
          onClick={handlePostAnother}
          className="mt-4 rounded-full border border-brand px-5 py-2.5 text-sm font-medium text-brand hover:bg-brand/10"
        >
          {tc("postAnother")}
        </button>
      </div>
    );
  }

  if (pendingQuestion) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">{t("clarifyTitle")}</h2>
        <p className="mt-3 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
          {pendingQuestion}
        </p>
        <textarea
          value={clarifyAnswer}
          onChange={(e) => setClarifyAnswer(e.target.value)}
          rows={3}
          className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          onClick={handleClarifySubmit}
          disabled={loading || aiUnavailable}
          className={
            aiUnavailable
              ? "mt-3 rounded-full bg-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
              : "mt-3 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          }
        >
          {loading ? t("generating") : t("generate")}
        </button>
      </div>
    );
  }

  if (result) {
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
                href={styledPhotoPath}
                download
                className="text-xs font-medium text-brand underline"
              >
                {tc("downloadStyledPhoto")}
              </a>
            )}
          </div>
        )}
        {titleOptions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {tc("chooseTitle")}
            </p>
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

  const mediaField = (
    <div>
      <MediaUploadField
        label={tc("stepMedia")}
        file={mediaFile}
        onChange={handleMediaSelected}
        accept="image/*"
        uploadLabel={tc("uploadCta")}
        removeLabel={tc("removePhoto")}
      />
      {stylingPhoto && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {tc("stylingPhoto")}
        </p>
      )}
      {photoVariants.length > 1 && !styledPhotoPath && !stylingPhoto && (
        <div className="mt-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{tc("choosePhotoVariant")}</p>
          <div className="mt-2 flex gap-2">
            {photoVariants.map((variantPath) => (
              <button
                key={variantPath}
                type="button"
                onClick={() => setPreviewingVariant(variantPath)}
                className="overflow-hidden rounded-lg border-2 border-transparent hover:border-brand"
              >
                <Image
                  src={variantPath}
                  alt=""
                  width={96}
                  height={96}
                  className="h-24 w-24 object-cover"
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
              href={styledPhotoPath}
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

  if (questionMode === "AI_ADAPTIVE" && !questionsFetched) {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold">{tc("questionnaireTitle")}</h2>
        <div className="mt-6 flex flex-col gap-5">
          {mediaField}

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
            disabled={loadingQuestions || uploading || !category || aiUnavailable}
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
        <div className="mt-6 flex flex-col gap-5">
          <div>
            <label className="text-sm font-medium">{q.question}</label>
            <div className="mt-2">
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
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={() => setFollowUpIndex(followUpIndex + 1)}
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            {tc("continueLabel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-xl font-semibold">{tc("questionnaireTitle")}</h2>
      <div className="mt-6 flex flex-col gap-5">
        {questionMode === "FIXED" && mediaField}

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

        <div>
          <label className="text-sm font-medium">{tc("contactRequiredLabel")}</label>
          <div className="mt-2 flex flex-col gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tc("namePlaceholder")}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={handleSaveDraft}
              placeholder={tc("phonePlaceholder")}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={loading || uploading || aiUnavailable || !name.trim() || !phone.trim()}
          className={
            aiUnavailable
              ? "mt-2 rounded-full bg-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
              : "mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          }
        >
          {loading || uploading ? t("generating") : t("generate")}
        </button>
      </div>
    </div>
  );
}
