"use client";

import { useState } from "react";
import { IconActionButton } from "./icon-action-button";
import { Modal } from "./modal";

export function CampaignViewButton({
  url,
  label,
}: {
  url: string;
  label: string;
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
      <Modal open={open} onClose={() => setOpen(false)} title={label} wide>
        <iframe
          src={url}
          title={label}
          className="h-[70vh] w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
        />
      </Modal>
    </>
  );
}
