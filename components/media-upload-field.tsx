"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";

export function MediaUploadField({
  label,
  file,
  onChange,
  accept = "image/*",
  uploadLabel,
  removeLabel,
  existingUrl,
  onRemoveExisting,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  uploadLabel: string;
  removeLabel: string;
  /** An already-uploaded image to show when no new file has been picked yet (edit mode). */
  existingUrl?: string | null;
  onRemoveExisting?: () => void;
}) {
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-2">
        {previewUrl && file ? (
          <div className="relative inline-block">
            {file.type.startsWith("video/") ? (
              <video
                src={previewUrl}
                controls
                className="max-h-56 rounded-lg border border-zinc-200 dark:border-zinc-800"
              />
            ) : (
              // Local blob preview — next/image can't optimize blob: URLs
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className="h-40 w-40 rounded-lg border border-zinc-200 object-cover dark:border-zinc-800"
              />
            )}
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={removeLabel}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900/80 text-xs text-white hover:bg-zinc-900"
            >
              ✕
            </button>
          </div>
        ) : existingUrl ? (
          <div className="relative inline-block">
            <Image
              src={existingUrl}
              alt=""
              width={160}
              height={160}
              className="h-40 w-40 rounded-lg border border-zinc-200 object-cover dark:border-zinc-800"
            />
            {onRemoveExisting && (
              <button
                type="button"
                onClick={onRemoveExisting}
                aria-label={removeLabel}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900/80 text-xs text-white hover:bg-zinc-900"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <label className="flex h-32 w-full max-w-xs cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 text-sm text-zinc-500 transition-colors hover:border-brand hover:text-brand dark:border-zinc-700 dark:hover:border-brand">
            <span className="text-2xl">📷</span>
            <span>{uploadLabel}</span>
            <input
              type="file"
              accept={accept}
              onChange={(e) => onChange(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  );
}
