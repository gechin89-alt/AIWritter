"use client";

import Image from "next/image";

export type PrizeRow = {
  name: string;
  description: string;
  imageFile: File | null;
  /** Already-uploaded image path when editing an existing prize. */
  existingImagePath?: string | null;
};

export function PrizeListEditor({
  prizes,
  onChange,
}: {
  prizes: PrizeRow[];
  onChange: (prizes: PrizeRow[]) => void;
}) {
  function update(index: number, patch: Partial<PrizeRow>) {
    const next = [...prizes];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function add() {
    onChange([...prizes, { name: "", description: "", imageFile: null }]);
  }

  function remove(index: number) {
    onChange(prizes.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {prizes.map((prize, i) => (
        <div
          key={i}
          className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">
              #{i + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="px-2 text-sm text-red-600"
              aria-label="Remove prize"
            >
              ×
            </button>
          </div>
          <input
            value={prize.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="Prize name, e.g. 第一奖 / iPhone 15"
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <textarea
            value={prize.description}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="Prize description (optional)"
            rows={2}
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />

          {prize.existingImagePath && !prize.imageFile && (
            <div className="mt-2 flex items-center gap-2">
              <Image
                src={prize.existingImagePath}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded object-cover"
              />
              <button
                type="button"
                onClick={() => update(i, { existingImagePath: null })}
                className="text-xs text-red-600 underline"
              >
                Remove photo
              </button>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              update(i, { imageFile: e.target.files?.[0] ?? null })
            }
            className="mt-2 block w-full text-sm"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm font-medium text-brand underline"
      >
        + Add prize
      </button>
    </div>
  );
}
