"use client";

import { useState } from "react";
import Image from "next/image";
import { Modal } from "./modal";
import { IconActionButton } from "./icon-action-button";

export function CampaignQr({
  dataUrl,
  url,
  showLabel,
  hideLabel,
  scanLabel,
}: {
  dataUrl: string;
  url: string;
  showLabel: string;
  hideLabel: string;
  scanLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconActionButton
        icon="🔳"
        label={showLabel}
        onClick={() => setOpen(true)}
        active={open}
        variant="neutral"
      />
      <Modal open={open} onClose={() => setOpen(false)} title={scanLabel}>
        <div className="flex flex-col items-center gap-3">
          <Image
            src={dataUrl}
            alt={scanLabel}
            width={220}
            height={220}
            unoptimized
            className="rounded-lg border border-zinc-200 dark:border-zinc-800"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-center text-xs text-zinc-500 underline"
          >
            {url}
          </a>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-1 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            {hideLabel}
          </button>
        </div>
      </Modal>
    </>
  );
}
