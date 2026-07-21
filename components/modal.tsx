"use client";

import { type ReactNode } from "react";
import { useTranslations } from "next-intl";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useTranslations("common");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`animate-fade-in-up relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-950 ${
          wide ? "max-w-3xl" : "max-w-md"
        }`}
      >
        <div className="flex items-center justify-between">
          {title && (
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {title}
            </h3>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="ml-auto rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
        <div className={title ? "mt-4" : ""}>{children}</div>
      </div>
    </div>
  );
}
