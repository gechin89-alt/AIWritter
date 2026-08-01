"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { IconActionButton } from "./icon-action-button";
import { Modal } from "./modal";
import { MediaUploadField } from "./media-upload-field";
import { toDownloadUrl } from "@/lib/download-url";

export function CampaignPosterGenerator({
  campaignId,
  label,
  labels,
}: {
  campaignId: string;
  label: string;
  labels: {
    uploadCta: string;
    removePhoto: string;
    briefLabel: string;
    briefPlaceholder: string;
    draftCta: string;
    drafting: string;
    titleLabel: string;
    subtitleLabel: string;
    taglineLabel: string;
    generateCta: string;
    generating: string;
    result: string;
    download: string;
    error: string;
    hint: string;
  };
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [briefText, setBriefText] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setOpen(false);
    setFile(null);
    setBriefText("");
    setTitle("");
    setSubtitle("");
    setTagline("");
    setPosterUrl(null);
    setError(null);
  }

  async function uploadFile(): Promise<string | undefined> {
    if (!file) return undefined;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.path as string;
  }

  async function handleDraft() {
    setDrafting(true);
    setError(null);
    try {
      // No mediaPath - the API only drafts copy, doesn't render, when a
      // photo hasn't been picked/uploaded yet.
      const res = await fetch("/api/admin/campaign-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, briefText, locale }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setTitle(data.title ?? "");
      setSubtitle(data.subtitle ?? "");
      setTagline(data.tagline ?? "");
    } catch {
      setError(labels.error);
    } finally {
      setDrafting(false);
    }
  }

  async function handleGenerate() {
    if (!file) return;
    setGenerating(true);
    setError(null);
    setPosterUrl(null);
    try {
      const mediaPath = await uploadFile();
      if (!mediaPath) throw new Error("upload failed");
      const res = await fetch("/api/admin/campaign-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          mediaPath,
          briefText,
          locale,
          title: title.trim() || undefined,
          subtitle: subtitle.trim() || undefined,
          tagline: tagline.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setPosterUrl(data.posterUrl);
      setTitle(data.title ?? title);
      setSubtitle(data.subtitle ?? subtitle);
      setTagline(data.tagline ?? tagline);
    } catch {
      setError(labels.error);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <IconActionButton icon="🖼️" label={label} onClick={() => setOpen(true)} active={open} variant="neutral" />
      <Modal open={open} onClose={handleClose} title={label}>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{labels.hint}</p>
          <MediaUploadField
            label=""
            file={file}
            onChange={setFile}
            accept="image/*"
            uploadLabel={labels.uploadCta}
            removeLabel={labels.removePhoto}
          />

          <div>
            <label className="text-xs text-zinc-600 dark:text-zinc-400">{labels.briefLabel}</label>
            <div className="mt-2 flex gap-2">
              <textarea
                value={briefText}
                onChange={(e) => setBriefText(e.target.value)}
                placeholder={labels.briefPlaceholder}
                rows={2}
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
              <button
                type="button"
                onClick={handleDraft}
                disabled={drafting}
                className="h-fit shrink-0 rounded-full border border-brand px-3 py-2 text-xs font-medium text-brand hover:bg-brand/10 disabled:opacity-50"
              >
                {drafting ? labels.drafting : labels.draftCta}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={labels.titleLabel}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={labels.subtitleLabel}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder={labels.taglineLabel}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!file || generating}
            className="w-fit rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {generating ? labels.generating : labels.generateCta}
          </button>

          {posterUrl && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{labels.result}</p>
              <Image
                src={posterUrl}
                alt=""
                width={220}
                height={293}
                className="mt-2 max-h-96 w-auto rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
              />
              <a
                href={toDownloadUrl(posterUrl)}
                download
                className="mt-2 inline-block text-xs font-medium text-brand underline"
              >
                {labels.download}
              </a>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
