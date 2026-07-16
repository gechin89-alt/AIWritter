"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { IconActionButton } from "./icon-action-button";

export function CampaignActions({
  id,
  active,
  hasSubmissions,
  labels,
}: {
  id: string;
  active: boolean;
  hasSubmissions: boolean;
  labels: {
    activate: string;
    deactivate: string;
    deleteLabel: string;
    confirmDelete: string;
    cannotDelete: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setError("Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (hasSubmissions) {
      window.alert(labels.cannotDelete);
      return;
    }
    if (!window.confirm(labels.confirmDelete)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setError("Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <IconActionButton
        icon={active ? "⏸" : "▶"}
        label={active ? labels.deactivate : labels.activate}
        onClick={toggleActive}
        disabled={busy}
        variant="neutral"
      />
      <IconActionButton
        icon="🗑"
        label={labels.deleteLabel}
        onClick={handleDelete}
        disabled={busy}
        variant="danger"
      />
      {error && <p className="basis-full text-xs text-red-600">{error}</p>}
    </>
  );
}
