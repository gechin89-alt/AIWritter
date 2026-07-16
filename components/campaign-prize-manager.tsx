"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { PrizeListEditor, type PrizeRow } from "./prize-list-editor";
import { IconActionButton } from "./icon-action-button";
import { Modal } from "./modal";

export function CampaignPrizeManager({
  campaignId,
  initialPrizes,
  labels,
}: {
  campaignId: string;
  initialPrizes: {
    name: string;
    description: string | null;
    imagePath: string | null;
  }[];
  labels: { manage: string; save: string; cancel: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prizes, setPrizes] = useState<PrizeRow[]>(() =>
    initialPrizes.map((p) => ({
      name: p.name,
      description: p.description ?? "",
      imageFile: null,
      existingImagePath: p.imagePath,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadImage(file: File): Promise<string | undefined> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.path as string;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const prepared = await Promise.all(
        prizes
          .filter((p) => p.name.trim())
          .map(async (p, i) => ({
            rank: i + 1,
            name: p.name.trim(),
            description: p.description.trim() || undefined,
            imagePath: p.imageFile
              ? await uploadImage(p.imageFile)
              : p.existingImagePath || undefined,
          })),
      );
      const res = await fetch(`/api/admin/campaigns/${campaignId}/prizes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prizes: prepared }),
      });
      if (!res.ok) throw new Error("failed");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Failed to save prizes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <IconActionButton
        icon="🎁"
        label={labels.manage}
        onClick={() => setOpen(true)}
        active={open}
        variant="brand"
      />
      <Modal open={open} onClose={() => setOpen(false)} title={labels.manage}>
        <PrizeListEditor prizes={prizes} onChange={setPrizes} />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
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
      </Modal>
    </>
  );
}
