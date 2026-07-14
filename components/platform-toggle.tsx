"use client";

type Platform = "XHS" | "INSTAGRAM";

export function PlatformToggle({
  value,
  onChange,
}: {
  value: Platform;
  onChange: (value: Platform) => void;
}) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onChange("XHS")}
        className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors ${
          value === "XHS"
            ? "border-brand bg-brand/10 text-brand"
            : "border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
        }`}
      >
        XHS
      </button>
      <button
        type="button"
        onClick={() => onChange("INSTAGRAM")}
        className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors ${
          value === "INSTAGRAM"
            ? "border-accent bg-accent/10 text-accent"
            : "border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
        }`}
      >
        Instagram
      </button>
    </div>
  );
}
