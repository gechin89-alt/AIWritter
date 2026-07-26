"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function AdminResetPasswordButton({ userId }: { userId: string }) {
  const t = useTranslations("admin");
  const [resetting, setResetting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (!window.confirm(t("resetPasswordConfirm"))) return;
    setResetting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setTempPassword(data.tempPassword);
      setCopied(false);
    } catch {
      setError(t("resetPasswordFailed"));
    } finally {
      setResetting(false);
    }
  }

  async function handleCopy() {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
  }

  if (tempPassword) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{t("resetPasswordHint")}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <code className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">{tempPassword}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {copied ? t("resetPasswordCopied") : t("resetPasswordCopy")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleReset}
        disabled={resetting}
        className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {resetting ? t("resetPasswordWorking") : t("resetPassword")}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
