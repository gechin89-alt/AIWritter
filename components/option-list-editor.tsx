"use client";

import { useTranslations } from "next-intl";

export function OptionListEditor({
  questionPlaceholder,
  question,
  onQuestionChange,
  options,
  onOptionsChange,
  includeOther,
  onIncludeOtherChange,
  multiSelect,
  onMultiSelectChange,
}: {
  questionPlaceholder: string;
  question: string;
  onQuestionChange: (value: string) => void;
  options: string[];
  onOptionsChange: (options: string[]) => void;
  includeOther: boolean;
  onIncludeOtherChange: (value: boolean) => void;
  multiSelect: boolean;
  onMultiSelectChange: (value: boolean) => void;
}) {
  const t = useTranslations("admin");

  function updateOption(index: number, value: string) {
    const next = [...options];
    next[index] = value;
    onOptionsChange(next);
  }

  function addOption() {
    onOptionsChange([...options, ""]);
  }

  function removeOption(index: number) {
    onOptionsChange(options.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {t("optionQuestionLabel")}
        </span>
        <input
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder={questionPlaceholder}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {t("optionAnswerLabel", { number: i + 1 })}
            </span>
            <input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={t("optionAnswerPlaceholder", { number: i + 1 })}
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            {options.length > 1 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="px-2 text-sm text-red-600"
                aria-label={t("optionRemoveAnswer")}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addOption}
        className="mt-2 text-sm font-medium text-brand underline"
      >
        {t("optionAddAnswer")}
      </button>

      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={includeOther}
          onChange={(e) => onIncludeOtherChange(e.target.checked)}
        />
        {t("optionIncludeOther")}
      </label>

      <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={multiSelect}
          onChange={(e) => onMultiSelectChange(e.target.checked)}
        />
        {t("optionMultiSelect")}
      </label>
    </div>
  );
}
