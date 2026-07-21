"use client";

import { useState } from "react";
import { IconActionButton } from "./icon-action-button";
import { Modal } from "./modal";
import { PrizeCards } from "./prize-cards";

export function CampaignViewButton({
  url,
  label,
  name,
  prizeInfo,
  prizes,
  termsText,
  prizesTitle,
  termsTitle,
  goToPageLabel,
}: {
  url: string;
  label: string;
  name: string;
  prizeInfo: string;
  prizes: {
    id: string;
    name: string;
    description: string | null;
    imagePath: string | null;
  }[];
  termsText: string;
  prizesTitle: string;
  termsTitle: string;
  goToPageLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconActionButton
        icon="👁"
        label={label}
        onClick={() => setOpen(true)}
        active={open}
        variant="neutral"
      />
      <Modal open={open} onClose={() => setOpen(false)} title={name}>
        {prizeInfo && (
          <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
            {prizeInfo}
          </p>
        )}
        <PrizeCards prizes={prizes} title={prizesTitle} />
        {termsText && (
          <details className="mt-4 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
              {termsTitle}
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-zinc-500 dark:text-zinc-400">
              {termsText}
            </p>
          </details>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block rounded-full bg-brand px-5 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          {goToPageLabel}
        </a>
      </Modal>
    </>
  );
}
