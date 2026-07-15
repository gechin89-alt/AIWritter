"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

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
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <button
          onClick={toggleActive}
          disabled={busy}
          className="text-sm font-medium text-zinc-600 underline hover:text-brand disabled:opacity-50 dark:text-zinc-400"
        >
          {active ? labels.deactivate : labels.activate}
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="text-sm font-medium text-red-600 underline hover:text-red-700 disabled:opacity-50"
        >
          {labels.deleteLabel}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
