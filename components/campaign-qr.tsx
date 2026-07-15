"use client";

import { useState } from "react";
import Image from "next/image";

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
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-brand underline"
      >
        {open ? hideLabel : showLabel}
      </button>
      {open && (
        <div className="mt-2 flex flex-col items-start gap-1">
          <Image
            src={dataUrl}
            alt={scanLabel}
            width={140}
            height={140}
            unoptimized
            className="rounded border border-zinc-200 dark:border-zinc-800"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 underline"
          >
            {url}
          </a>
        </div>
      )}
    </div>
  );
}
