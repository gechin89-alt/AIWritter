"use client";

import { useState, type ReactNode } from "react";

export function AdminTabs({
  tabs,
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              active === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tabs.find((tab) => tab.id === active)?.content}
      </div>
    </div>
  );
}
