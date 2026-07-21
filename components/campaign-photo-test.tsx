"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { IconActionButton } from "./icon-action-button";
import { Modal } from "./modal";
import { MediaUploadField } from "./media-upload-field";

export function CampaignPhotoTest({
  campaignSlug,
  label,
  labels,
}: {
  campaignSlug: string;
  label: string;
  labels: {
    uploadCta: string;
    removePhoto: string;
    run: string;
    running: string;
    result: string;
    error: string;
    hint: string;
  };
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setOpen(false);
    setFile(null);
    setResultPath(null);
    setError(null);
  }

  async function handleRun() {
    if (!file) return;
    setRunning(true);
    setError(null);
    setResultPath(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("upload failed");
      const uploadData = await uploadRes.json();

      const filterRes = await fetch("/api/photo-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaPath: uploadData.path, campaignSlug, locale }),
      });
      if (!filterRes.ok) throw new Error("filter failed");
      const filterData = await filterRes.json();
      setResultPath(filterData.filtered ? filterData.path : uploadData.path);
    } catch {
      setError(labels.error);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <IconActionButton icon="🧪" label={label} onClick={() => setOpen(true)} active={open} variant="neutral" />
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
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleRun}
            disabled={!file || running}
            className="w-fit rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {running ? labels.running : labels.run}
          </button>
          {resultPath && (
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{labels.result}</p>
              <Image
                src={resultPath}
                alt=""
                width={280}
                height={280}
                className="mt-2 max-h-72 w-auto rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
              />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
