"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const DEFAULT_EDIT_LIMIT = 3;

export function AdminEditLimitControl({
  submissionId,
  editCount,
  editLimitOverride,
}: {
  submissionId: string;
  editCount: number;
  editLimitOverride: number | null;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const limit = editLimitOverride ?? DEFAULT_EDIT_LIMIT;

  async function handleAction(action: "reset" | "grant") {
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/edit-limit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {t("editCountLabel", { count: editCount, limit })}
      </span>
      <button
        type="button"
        onClick={() => handleAction("reset")}
        disabled={working}
        className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {t("editCountReset")}
      </button>
      <button
        type="button"
        onClick={() => handleAction("grant")}
        disabled={working}
        className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {t("editCountGrant")}
      </button>
    </div>
  );
}
