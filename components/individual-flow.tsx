"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ChoiceGroupWithOther } from "./choice-group-with-other";
import { MediaUploadField } from "./media-upload-field";
import { BrandProfileEditor } from "./brand-profile-editor";
import { PostHistoryButton } from "./post-history-button";
import { Modal } from "./modal";
import { toDownloadUrl } from "@/lib/download-url";

type ChatTurn = { role: "user" | "assistant"; content: string };
type TextMode = "auto" | "custom" | "none";

export function IndividualFlow({
  used,
  limit,
  unlimited = false,
}: {
  used: number;
  limit: number;
  unlimited?: boolean;
}) {
  const t = useTranslations("individual");
  const locale = useLocale();
  const router = useRouter();
  const remaining = Math.max(0, limit - used);

  const identityOptions = t.raw("identityOptions") as string[];
  const toneOptions = t.raw("toneOptions") as string[];
  const styleOptions = t.raw("styleOptions") as string[];

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPath, setMediaPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const isVideo = mediaFile ? mediaFile.type.startsWith("video/") : false;

  // Defaults to "auto" so uploading a photo with no extra taps just works
  // (matches the pre-text-mode behavior); removing the photo resets this so
  // the choice is asked fresh for whatever gets uploaded next.
  const [textModeChoice, setTextModeChoice] = useState<TextMode>("auto");
  const [customText, setCustomText] = useState("");
  const [stylingPhoto, setStylingPhoto] = useState(false);
  const [styledPhotoPath, setStyledPhotoPath] = useState<string | null>(null);
  const [photoVariants, setPhotoVariants] = useState<string[]>([]);
  const [previewingVariant, setPreviewingVariant] = useState<string | null>(null);
  const [photoStepConfirmed, setPhotoStepConfirmed] = useState(false);

  // Once past the photo step, show the chosen photo as a small read-only
  // reference above the questions — no upload/remove controls, so it can't
  // be accidentally changed mid-questionnaire (a full page refresh is the
  // only way to restart with a different photo). Declared early since the
  // pendingQuestion chat screen (an early return further down) needs it too.
  const lockedPhotoPath = styledPhotoPath ?? mediaPath;
  const lockedPhotoPreview = lockedPhotoPath ? (
    <div className="mb-1 flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
      <Image
        src={lockedPhotoPath}
        alt=""
        width={48}
        height={48}
        className="h-12 w-12 rounded-md object-cover"
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("photoLockedHint")}</p>
    </div>
  ) : null;

  const [identity, setIdentity] = useState("");
  const [tone, setTone] = useState("");
  const [style, setStyle] = useState("");
  const [freeText, setFreeText] = useState("");
  // Instagram support is hidden for now — XHS only.
  const platform = "XHS" as const;

  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<{ content: string; suggestReupload?: boolean } | null>(
    null,
  );
  const [clarifyAnswer, setClarifyAnswer] = useState("");

  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);

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
        // Surface the real reason instead of a generic message, so a
        // failure is actionable from what's on screen alone, no devtools
        // needed.
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

  function handleMediaSelected(file: File | null) {
    setMediaFile(file);
    setMediaPath(null);
    setStyledPhotoPath(null);
    setPhotoVariants([]);
    if (!file) {
      // Removing the photo resets the text-mode question so it's asked
      // fresh for whatever gets uploaded next.
      setTextModeChoice("auto");
      setCustomText("");
      return;
    }
    // Defaults to "auto", so a fresh upload just works immediately unless
    // the customer had already picked "custom" and typed something.
    if (file.type.startsWith("image/") && (textModeChoice !== "custom" || customText.trim())) {
      runPhotoStyling(file, textModeChoice, customText);
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
        setError(t("errorGeneric"));
        return;
      }
      const res = await fetch("/api/photo-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaPath: resolvedPath, locale, textMode: mode, customText: text }),
      });
      if (res.ok) {
        const data = await res.json();
        const variants: string[] = data.variants ?? [];
        if (data.filtered && variants.length > 1) {
          setPhotoVariants(variants);
        } else if (data.filtered && variants.length === 1) {
          setStyledPhotoPath(variants[0]);
        }
      } else {
        setError(t("errorGeneric"));
      }
    } catch (err) {
      // Previously uncaught here — on a slow/dropped mobile connection this
      // silently reset stylingPhoto with no variants and no visible error.
      // Appending the raw reason makes this diagnosable from what the
      // customer sees on screen alone, no devtools needed.
      const message = err instanceof Error ? err.message : String(err);
      setError(`${t("errorGeneric")} (${message})`);
    } finally {
      setStylingPhoto(false);
    }
  }

  function handleChoosePhotoVariant(path: string) {
    setStyledPhotoPath(path);
  }

  const photoSelectionPending = photoVariants.length > 0 && !styledPhotoPath;

  async function callGenerate(nextHistory: ChatTurn[], resolvedMediaPath?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          identity,
          tone,
          style,
          freeText,
          mediaPath: resolvedMediaPath ?? styledPhotoPath ?? mediaPath ?? undefined,
          history: nextHistory,
          locale,
        }),
      });
      if (res.status === 402) {
        router.push("/upgrade");
        return;
      }
      if (res.status === 503) {
        setAiUnavailable(true);
        setError(unlimited ? t("aiUnavailableAdmin") : t("aiUnavailable"));
        return;
      }
      if (!res.ok) throw new Error("generate failed");
      const data = await res.json();
      if (data.type === "question") {
        setPendingQuestion({ content: data.content, suggestReupload: data.suggestReupload });
        setHistory([...nextHistory, { role: "assistant", content: data.content }]);
      } else {
        setPendingQuestion(null);
        setResult(data.content);
      }
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!unlimited && remaining <= 0) {
      router.push("/upgrade");
      return;
    }
    const path = await uploadMediaIfNeeded();
    await callGenerate([], path);
  }

  async function handleClarifySubmit() {
    if (!clarifyAnswer.trim()) return;
    const nextHistory: ChatTurn[] = [
      ...history,
      { role: "user", content: clarifyAnswer },
    ];
    setClarifyAnswer("");
    await callGenerate(nextHistory);
  }

  function handleReupload() {
    setPendingQuestion(null);
    setHistory([]);
    setClarifyAnswer("");
    setMediaFile(null);
    setMediaPath(null);
    setStyledPhotoPath(null);
    setPhotoVariants([]);
    setTextModeChoice("auto");
    setCustomText("");
    setPhotoStepConfirmed(false);
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleGoToXHS() {
    // window.open must be the very first thing that happens, synchronously,
    // in direct response to the click — after any `await`, several browsers
    // (especially mobile) no longer treat it as a user-initiated action and
    // silently block the popup.
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

  if (result) {
    const finalPhotoPath = styledPhotoPath ?? mediaPath;
    return (
      <div className="w-full max-w-lg">
        <h2 className="text-xl font-semibold">{t("result")}</h2>
        {finalPhotoPath &&
          (isVideo ? (
            <video
              src={finalPhotoPath}
              controls
              className="mt-4 max-h-72 w-auto rounded-lg border border-zinc-200 dark:border-zinc-800"
            />
          ) : (
            <Image
              src={finalPhotoPath}
              alt=""
              width={240}
              height={240}
              className="mt-4 max-h-72 w-auto rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
            />
          ))}
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
            {t("goToXHS")}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{t("goToXHSHint")}</p>
      </div>
    );
  }

  if (pendingQuestion) {
    return (
      <div className="w-full max-w-lg">
        <h2 className="text-lg font-semibold">{t("clarifyTitle")}</h2>
        {/* Chat-style thread, matching commercial-flow's treatment: the
            back-and-forth so far renders as a growing conversation instead
            of replacing the last question each round. */}
        {lockedPhotoPreview}
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
            {t("reuploadPhoto")}
          </button>
        )}

        <textarea
          value={clarifyAnswer}
          onChange={(e) => setClarifyAnswer(e.target.value)}
          rows={2}
          placeholder={t("chatReplyPlaceholder")}
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
          {loading ? t("sendingReply") : t("sendReply")}
        </button>
      </div>
    );
  }

  const previewModal = (
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
            {t("chooseThisPhoto")}
          </button>
        </div>
      )}
    </Modal>
  );

  if (!photoStepConfirmed) {
    return (
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <div className="flex items-center gap-1.5">
            <PostHistoryButton />
            <BrandProfileEditor />
          </div>
        </div>
        <p
          className={`mt-2 text-sm ${!unlimited && remaining <= 0 ? "text-red-600" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          {unlimited ? t("quotaUnlimited") : t("quotaRemaining", { count: remaining })}
        </p>

        <div className="mt-6 flex flex-col gap-5">
          {!isVideo && !styledPhotoPath && !stylingPhoto && (
            <div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("chooseTextMode")}</p>
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
                  {t("textModeAuto")}
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
                  {t("textModeCustom")}
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
                  {t("textModeNone")}
                </button>
              </div>
              {textModeChoice === "custom" && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value.slice(0, 30))}
                    placeholder={t("customTextPlaceholder")}
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
                      {t("confirmTextMode")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <MediaUploadField
            label={t("stepMedia")}
            file={mediaFile}
            onChange={handleMediaSelected}
            accept="image/*,video/*"
            uploadLabel={t("uploadCta")}
            removeLabel={t("removePhoto")}
            disableRemove={stylingPhoto}
          />

          {stylingPhoto && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("stylingPhoto")}</p>
          )}

          {photoVariants.length > 1 && !styledPhotoPath && !stylingPhoto && (
            <div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("choosePhotoVariant")}</p>
              {/* grid instead of a fixed-width flex row — 3 fixed 96px
                  thumbnails can be wider than a narrow phone screen, pushing
                  them off-screen with no visible scrollbar. A 3-column grid
                  always fits. */}
              <div className="mt-2 grid grid-cols-3 gap-2">
                {photoVariants.map((variantPath) => (
                  <button
                    key={variantPath}
                    type="button"
                    onClick={() => setPreviewingVariant(variantPath)}
                    className="aspect-square overflow-hidden rounded-lg border-2 border-transparent hover:border-brand"
                  >
                    <Image src={variantPath} alt="" width={96} height={96} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {previewModal}

          {styledPhotoPath && !stylingPhoto && (
            <div className="flex items-center gap-3 rounded-lg border border-brand/30 bg-brand/5 p-3">
              <Image
                src={styledPhotoPath}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 rounded-md object-cover"
              />
              <div className="flex flex-col gap-1">
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("styledPhotoReady")}</p>
                <a href={toDownloadUrl(styledPhotoPath)} download className="text-xs font-medium text-brand underline">
                  {t("downloadStyledPhoto")}
                </a>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => setPhotoStepConfirmed(true)}
            disabled={photoSelectionPending || stylingPhoto || uploading}
            className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {t("continueLabel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <div className="mt-6 flex flex-col gap-5">
        {lockedPhotoPreview}
        <div>
          <label className="text-sm font-medium">{t("identity")}</label>
          <div className="mt-2">
            <ChoiceGroupWithOther
              options={identityOptions}
              otherLabel={t("otherOption")}
              otherPlaceholder={t("otherPlaceholder")}
              value={identity}
              onChange={setIdentity}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">{t("tone")}</label>
          <div className="mt-2">
            <ChoiceGroupWithOther
              options={toneOptions}
              otherLabel={t("otherOption")}
              otherPlaceholder={t("otherPlaceholder")}
              value={tone}
              onChange={setTone}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">{t("style")}</label>
          <div className="mt-2">
            <ChoiceGroupWithOther
              options={styleOptions}
              otherLabel={t("otherOption")}
              otherPlaceholder={t("otherPlaceholder")}
              value={style}
              onChange={setStyle}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">{t("freeText")}</label>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={t("freeTextPlaceholder")}
            rows={4}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={loading || uploading || aiUnavailable}
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
