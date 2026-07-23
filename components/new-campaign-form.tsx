"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { OptionListEditor } from "./option-list-editor";
import { PrizeListEditor, type PrizeRow } from "./prize-list-editor";
import { MediaUploadField } from "./media-upload-field";
import { Modal } from "./modal";

export function NewCampaignForm({ label }: { label: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [brandLink, setBrandLink] = useState("");
  const [enableBrandColor, setEnableBrandColor] = useState(false);
  const [brandColor, setBrandColor] = useState("#ff2442");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [productDescription, setProductDescription] = useState("");
  const [prizeInfo, setPrizeInfo] = useState("");
  const [termsText, setTermsText] = useState("");
  const [questionMode, setQuestionMode] = useState<"FIXED" | "AI_ADAPTIVE">("FIXED");
  const [prizes, setPrizes] = useState<PrizeRow[]>([]);

  const [identityQuestion, setIdentityQuestion] = useState("");
  const [identityOptions, setIdentityOptions] = useState<string[]>([""]);
  const [identityIncludeOther, setIdentityIncludeOther] = useState(false);
  const [identityMultiSelect, setIdentityMultiSelect] = useState(false);

  const [toneQuestion, setToneQuestion] = useState("");
  const [toneOptions, setToneOptions] = useState<string[]>([""]);
  const [toneIncludeOther, setToneIncludeOther] = useState(false);
  const [toneMultiSelect, setToneMultiSelect] = useState(false);

  const [styleQuestion, setStyleQuestion] = useState("");
  const [styleOptions, setStyleOptions] = useState<string[]>([""]);
  const [styleIncludeOther, setStyleIncludeOther] = useState(false);
  const [styleMultiSelect, setStyleMultiSelect] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Trimming leading/trailing dashes happens only at submit time (see
  // handleSubmit) — doing it on every keystroke here would strip a dash the
  // instant you type it, since it's briefly the last character typed,
  // making it impossible to type a dash at all while typing left-to-right.
  function sanitizeSlug(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-");
  }

  function cleanOptions(options: string[]): string[] | undefined {
    const items = options.map((s) => s.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  function resetForm() {
    setSlug("");
    setName("");
    setBrandLink("");
    setEnableBrandColor(false);
    setBrandColor("#ff2442");
    setLogoFile(null);
    setProductDescription("");
    setPrizeInfo("");
    setTermsText("");
    setQuestionMode("FIXED");
    setIdentityQuestion("");
    setIdentityOptions([""]);
    setIdentityIncludeOther(false);
    setIdentityMultiSelect(false);
    setToneQuestion("");
    setToneOptions([""]);
    setToneIncludeOther(false);
    setToneMultiSelect(false);
    setStyleQuestion("");
    setStyleOptions([""]);
    setStyleIncludeOther(false);
    setStyleMultiSelect(false);
    setPrizes([]);
  }

  async function uploadFile(file: File): Promise<string | undefined> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.path as string;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const preparedPrizes = (
        await Promise.all(
          prizes
            .filter((p) => p.name.trim())
            .map(async (p, i) => ({
              rank: i + 1,
              name: p.name.trim(),
              description: p.description.trim() || undefined,
              imagePath: p.imageFile
                ? await uploadFile(p.imageFile)
                : undefined,
            })),
        )
      );

      const logoPath = logoFile ? await uploadFile(logoFile) : undefined;

      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.replace(/^-+|-+$/g, ""),
          name,
          brandLink,
          brandColor: enableBrandColor ? brandColor : undefined,
          logoPath,
          productDescription,
          prizeInfo,
          termsText,
          questionMode,
          identityQuestion: identityQuestion || undefined,
          identityOptions: cleanOptions(identityOptions),
          identityIncludeOther,
          identityMultiSelect,
          toneQuestion: toneQuestion || undefined,
          toneOptions: cleanOptions(toneOptions),
          toneIncludeOther,
          toneMultiSelect,
          styleQuestion: styleQuestion || undefined,
          styleOptions: cleanOptions(styleOptions),
          styleIncludeOther,
          styleMultiSelect,
          prizes: preparedPrizes.length > 0 ? preparedPrizes : undefined,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      setError(t("createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={label} wide>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            required
            value={slug}
            onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
            placeholder={t("formSlugPlaceholder")}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("formNamePlaceholder")}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            required
            value={brandLink}
            onChange={(e) => setBrandLink(e.target.value)}
            placeholder={t("formBrandLinkPlaceholder")}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={enableBrandColor}
              onChange={(e) => setEnableBrandColor(e.target.checked)}
            />
            {t("formBrandColorLabel")}
            {enableBrandColor && (
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-8 w-14 cursor-pointer rounded border border-zinc-300 dark:border-zinc-700"
              />
            )}
          </label>
          <MediaUploadField
            label={t("formLogoLabel")}
            file={logoFile}
            onChange={setLogoFile}
            accept="image/*"
            uploadLabel={t("formLogoUploadCta")}
            removeLabel={t("formLogoRemove")}
          />
          <textarea
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            placeholder={t("formProductDescriptionPlaceholder")}
            rows={2}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <textarea
            value={prizeInfo}
            onChange={(e) => setPrizeInfo(e.target.value)}
            placeholder={t("formPrizeInfoPlaceholder")}
            rows={2}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <textarea
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
            placeholder={t("formTermsPlaceholder")}
            rows={2}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />

          <div className="mt-1 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
            {t("formPrizesHint")}
          </div>
          <PrizeListEditor prizes={prizes} onChange={setPrizes} />

          <div className="mt-1 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
            {t("formQuestionSource")}
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={questionMode === "FIXED"}
                onChange={() => setQuestionMode("FIXED")}
              />
              {t("formFixedQuestions")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={questionMode === "AI_ADAPTIVE"}
                onChange={() => setQuestionMode("AI_ADAPTIVE")}
              />
              {t("formAiAdaptive")}
            </label>
          </div>

          {questionMode === "FIXED" && (
            <>
              <div className="border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
                {t("formCustomizeHint")}
              </div>

              <OptionListEditor
                questionPlaceholder={t("formIdentityQPlaceholder")}
                question={identityQuestion}
                onQuestionChange={setIdentityQuestion}
                options={identityOptions}
                onOptionsChange={setIdentityOptions}
                includeOther={identityIncludeOther}
                onIncludeOtherChange={setIdentityIncludeOther}
                multiSelect={identityMultiSelect}
                onMultiSelectChange={setIdentityMultiSelect}
              />

              <OptionListEditor
                questionPlaceholder={t("formToneQPlaceholder")}
                question={toneQuestion}
                onQuestionChange={setToneQuestion}
                options={toneOptions}
                onOptionsChange={setToneOptions}
                includeOther={toneIncludeOther}
                onIncludeOtherChange={setToneIncludeOther}
                multiSelect={toneMultiSelect}
                onMultiSelectChange={setToneMultiSelect}
              />

              <OptionListEditor
                questionPlaceholder={t("formStyleQPlaceholder")}
                question={styleQuestion}
                onQuestionChange={setStyleQuestion}
                options={styleOptions}
                onOptionsChange={setStyleOptions}
                includeOther={styleIncludeOther}
                onIncludeOtherChange={setStyleIncludeOther}
                multiSelect={styleMultiSelect}
                onMultiSelectChange={setStyleMultiSelect}
              />
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {t("save")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
