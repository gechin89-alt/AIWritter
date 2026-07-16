"use client";

import { useLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const activeIndex = (routing.locales as readonly string[]).indexOf(locale);

  return (
    <div className="relative inline-grid grid-cols-2 items-center rounded-full border border-zinc-300 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-brand shadow-sm transition-transform duration-300 ease-out"
        style={{
          transform: activeIndex === 1 ? "translateX(100%)" : "translateX(0)",
        }}
      />
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          aria-label={loc === "en" ? "English" : "中文"}
          aria-pressed={loc === locale}
          onClick={() => router.replace(pathname, { locale: loc })}
          className={`relative z-10 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            loc === locale
              ? "text-white"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          {loc === "en" ? "EN" : "中文"}
        </button>
      ))}
    </div>
  );
}
