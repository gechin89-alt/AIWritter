"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Modal } from "./modal";
import { IconActionButton } from "./icon-action-button";

export function BrandProfileEditor() {
  const t = useTranslations("individual");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [brandDescription, setBrandDescription] = useState("");
  const [styleSampleText, setStyleSampleText] = useState("");
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    fetch("/api/brand-profile")
      .then((res) => res.json())
      .then((data) => {
        setBrandDescription(data.brandDescription ?? "");
        setStyleSampleText(data.styleSampleText ?? "");
        setImagePaths(data.brandImagePaths ?? []);
        setLoaded(true);
      });
  }, [open, loaded]);

  async function handleAddImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          uploaded.push(data.path as string);
        }
      }
      setImagePaths((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveImage(path: string) {
    setImagePaths((prev) => prev.filter((p) => p !== path));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/brand-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandDescription, styleSampleText, brandImagePaths: imagePaths }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <IconActionButton
        icon="🏷️"
        label={t("brandProfile")}
        onClick={() => setOpen(true)}
        active={open}
        variant="brand"
      />
      <Modal open={open} onClose={() => setOpen(false)} title={t("brandProfile")} wide>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("brandProfileHint")}</p>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium">{t("brandDescriptionLabel")}</label>
            <textarea
              value={brandDescription}
              onChange={(e) => setBrandDescription(e.target.value)}
              rows={3}
              placeholder={t("brandDescriptionPlaceholder")}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("styleSampleLabel")}</label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("styleSampleHint")}</p>
            <textarea
              value={styleSampleText}
              onChange={(e) => setStyleSampleText(e.target.value)}
              rows={5}
              placeholder={t("styleSamplePlaceholder")}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("brandImagesLabel")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {imagePaths.map((path) => (
                <div key={path} className="relative">
                  <Image
                    src={path}
                    alt=""
                    width={72}
                    height={72}
                    className="h-18 w-18 rounded-md border border-zinc-200 object-cover dark:border-zinc-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(path)}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900/80 text-xs text-white hover:bg-zinc-900"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <label className="flex h-18 w-18 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-zinc-300 text-xs text-zinc-500 hover:border-brand hover:text-brand dark:border-zinc-700">
                <span className="text-lg">+</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleAddImages(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>
            {uploading && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("uploading")}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-fit rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {saved ? t("saved") : saving ? t("saving") : t("save")}
          </button>
        </div>
      </Modal>
    </>
  );
}
