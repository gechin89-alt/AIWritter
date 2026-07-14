"use client";

export function ChoiceGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "border-brand bg-brand text-white"
                : "border-zinc-300 text-zinc-700 hover:border-brand hover:text-brand dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
