"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { DEFAULT_FREE_POST_LIMIT } from "@/lib/quota";

export function UserQuotaEditor({
  userId,
  postLimit,
}: {
  userId: string;
  postLimit: number | null;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [value, setValue] = useState(
    postLimit === null ? "" : String(postLimit),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const nextLimit = value.trim() === "" ? null : Number(value);
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postLimit: nextLimit }),
      });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setError(t("quotaUpdateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={String(DEFAULT_FREE_POST_LIMIT)}
        className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {t("save")}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
