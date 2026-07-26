"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function AdminResetPasswordButton({ userId }: { userId: string }) {
  const t = useTranslations("admin");
  const [mode, setMode] = useState<"idle" | "manual">("idle");
  const [manualValue, setManualValue] = useState("");
  const [resetting, setResetting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitReset(newPassword?: string) {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPassword ? { newPassword } : {}),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setTempPassword(data.tempPassword);
      setCopied(false);
      setMode("idle");
      setManualValue("");
    } catch {
      setError(t("resetPasswordFailed"));
    } finally {
      setResetting(false);
    }
  }

  function handleAutoGenerate() {
    if (!window.confirm(t("resetPasswordConfirm"))) return;
    submitReset();
  }

  function handleManualSubmit() {
    if (manualValue.trim().length < 6) return;
    if (!window.confirm(t("resetPasswordConfirm"))) return;
    submitReset(manualValue.trim());
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

  if (mode === "manual") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder={t("resetPasswordManualPlaceholder")}
            className="w-32 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={resetting || manualValue.trim().length < 6}
            className="rounded-full bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {resetting ? t("resetPasswordWorking") : t("resetPasswordManualConfirm")}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("idle");
              setManualValue("");
            }}
            className="text-xs text-zinc-500 underline dark:text-zinc-400"
          >
            {t("resetPasswordCancel")}
          </button>
        </div>
        {manualValue.trim().length > 0 && manualValue.trim().length < 6 && (
          <span className="text-xs text-red-600">{t("resetPasswordTooShort")}</span>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={handleAutoGenerate}
        disabled={resetting}
        className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {resetting ? t("resetPasswordWorking") : t("resetPasswordAuto")}
      </button>
      <button
        type="button"
        onClick={() => setMode("manual")}
        disabled={resetting}
        className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {t("resetPasswordManual")}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
