"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { OptionListEditor } from "./option-list-editor";
import { IconActionButton } from "./icon-action-button";
import { MediaUploadField } from "./media-upload-field";
import { Modal } from "./modal";

export type CampaignEditInitial = {
  name: string;
  brandLink: string;
  brandColor: string | null;
  logoPath: string | null;
  logoWatermarkEnabled: boolean;
  productDescription: string;
  prizeInfo: string;
  termsText: string;
  questionMode: "FIXED" | "AI_ADAPTIVE";
  identityQuestion: string;
  identityOptions: string[];
  identityIncludeOther: boolean;
  identityMultiSelect: boolean;
  toneQuestion: string;
  toneOptions: string[];
  toneIncludeOther: boolean;
  toneMultiSelect: boolean;
  styleQuestion: string;
  styleOptions: string[];
  styleIncludeOther: boolean;
  styleMultiSelect: boolean;
};

export function CampaignEditForm({
  campaignId,
  initial,
  labels,
}: {
  campaignId: string;
  initial: CampaignEditInitial;
  labels: { edit: string; save: string; cancel: string };
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState(initial.name);
  const [brandLink, setBrandLink] = useState(initial.brandLink);
  const [enableBrandColor, setEnableBrandColor] = useState(initial.brandColor !== null);
  const [brandColor, setBrandColor] = useState(initial.brandColor ?? "#ff2442");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [existingLogoPath, setExistingLogoPath] = useState(initial.logoPath);
  const [logoWatermarkEnabled, setLogoWatermarkEnabled] = useState(initial.logoWatermarkEnabled);
  const [productDescription, setProductDescription] = useState(
    initial.productDescription,
  );
  const [prizeInfo, setPrizeInfo] = useState(initial.prizeInfo);
  const [termsText, setTermsText] = useState(initial.termsText);
  const [questionMode, setQuestionMode] = useState(initial.questionMode);

  const [identityQuestion, setIdentityQuestion] = useState(initial.identityQuestion);
  const [identityOptions, setIdentityOptions] = useState<string[]>(
    initial.identityOptions.length ? initial.identityOptions : [""],
  );
  const [identityIncludeOther, setIdentityIncludeOther] = useState(
    initial.identityIncludeOther,
  );
  const [identityMultiSelect, setIdentityMultiSelect] = useState(
    initial.identityMultiSelect,
  );

  const [toneQuestion, setToneQuestion] = useState(initial.toneQuestion);
  const [toneOptions, setToneOptions] = useState<string[]>(
    initial.toneOptions.length ? initial.toneOptions : [""],
  );
  const [toneIncludeOther, setToneIncludeOther] = useState(initial.toneIncludeOther);
  const [toneMultiSelect, setToneMultiSelect] = useState(initial.toneMultiSelect);

  const [styleQuestion, setStyleQuestion] = useState(initial.styleQuestion);
  const [styleOptions, setStyleOptions] = useState<string[]>(
    initial.styleOptions.length ? initial.styleOptions : [""],
  );
  const [styleIncludeOther, setStyleIncludeOther] = useState(initial.styleIncludeOther);
  const [styleMultiSelect, setStyleMultiSelect] = useState(initial.styleMultiSelect);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cleanOptions(options: string[]): string[] {
    return options.map((s) => s.trim()).filter(Boolean);
  }

  async function uploadFile(file: File): Promise<string | undefined> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "logo");
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.path as string;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const logoPath = logoFile ? await uploadFile(logoFile) : existingLogoPath;

      const res = await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          brandLink,
          brandColor: enableBrandColor ? brandColor : null,
          logoPath,
          logoWatermarkEnabled,
          productDescription,
          prizeInfo,
          termsText,
          questionMode,
          identityQuestion,
          identityOptions: cleanOptions(identityOptions),
          identityIncludeOther,
          identityMultiSelect,
          toneQuestion,
          toneOptions: cleanOptions(toneOptions),
          toneIncludeOther,
          toneMultiSelect,
          styleQuestion,
          styleOptions: cleanOptions(styleOptions),
          styleIncludeOther,
          styleMultiSelect,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setOpen(false);
      router.refresh();
    } catch {
      setError(t("editFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <IconActionButton
        icon="✏️"
        label={labels.edit}
        onClick={() => setOpen(true)}
        active={open}
        variant="neutral"
      />
      <Modal open={open} onClose={() => setOpen(false)} title={labels.edit} wide>
        <div className="flex flex-col gap-3">
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
            existingUrl={existingLogoPath}
            onRemoveExisting={() => setExistingLogoPath(null)}
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={logoWatermarkEnabled}
              onChange={(e) => setLogoWatermarkEnabled(e.target.checked)}
            />
            {t("formLogoWatermarkToggle")}
          </label>
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
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {labels.save}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            >
              {labels.cancel}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
