"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function NotifyUserButton({
  phone,
  campaignName,
}: {
  phone: string;
  campaignName: string;
}) {
  const t = useTranslations("admin");
  const [copied, setCopied] = useState(false);

  async function handleCopyMessage() {
    const message = t("notifyMessage", { campaign: campaignName });
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleCopyMessage}
        title={t("notifyCopyHint")}
        className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
      >
        {copied ? t("notifyCopied") : t("notify")}
      </button>
      <a
        href={`tel:${phone}`}
        title={t("notifyCallHint")}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        📞
      </a>
    </div>
  );
}
