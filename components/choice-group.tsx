"use client";

export function ChoiceGroup({
  options,
  value,
  onChange,
  multiple = false,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  multiple?: boolean;
}) {
  const selected = multiple
    ? value.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  function handleClick(option: string) {
    if (!multiple) {
      onChange(option);
      return;
    }
    const isSelected = selected.includes(option);
    const next = isSelected
      ? selected.filter((s) => s !== option)
      : [...selected, option];
    onChange(next.join(", "));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = multiple ? selected.includes(option) : value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => handleClick(option)}
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
