"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

export type PrizeRow = {
  name: string;
  description: string;
  imageFile: File | null;
  /** Already-uploaded image path when editing an existing prize. */
  existingImagePath?: string | null;
  qty: string;
};

function PrizeRowFields({
  prize,
  index,
  onUpdate,
  onRemove,
}: {
  prize: PrizeRow;
  index: number;
  onUpdate: (patch: Partial<PrizeRow>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("admin");

  const newPreviewUrl = useMemo(
    () => (prize.imageFile ? URL.createObjectURL(prize.imageFile) : null),
    [prize.imageFile],
  );

  useEffect(() => {
    return () => {
      if (newPreviewUrl) URL.revokeObjectURL(newPreviewUrl);
    };
  }, [newPreviewUrl]);

  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500">
          #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="px-2 text-sm text-red-600"
          aria-label={t("prizeRemove")}
        >
          ×
        </button>
      </div>
      <input
        value={prize.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        placeholder={t("prizeNamePlaceholder")}
        className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <textarea
        value={prize.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
        placeholder={t("prizeDescPlaceholder")}
        rows={2}
        className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        value={prize.qty}
        onChange={(e) => onUpdate({ qty: e.target.value.replace(/[^0-9]/g, "") })}
        inputMode="numeric"
        placeholder={t("prizeQtyPlaceholder")}
        className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      {newPreviewUrl ? (
        <div className="mt-2 flex items-center gap-2">
          {/* Local blob preview of the just-selected file — next/image can't optimize blob: URLs */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={newPreviewUrl}
            alt=""
            className="h-12 w-12 rounded object-cover"
          />
          <button
            type="button"
            onClick={() => onUpdate({ imageFile: null })}
            className="text-xs text-red-600 underline"
          >
            {t("prizeRemovePhoto")}
          </button>
        </div>
      ) : (
        prize.existingImagePath && (
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
              onClick={() => onUpdate({ existingImagePath: null })}
              className="text-xs text-red-600 underline"
            >
              {t("prizeRemovePhoto")}
            </button>
          </div>
        )
      )}

      <input
        type="file"
        accept="image/*"
        onChange={(e) => onUpdate({ imageFile: e.target.files?.[0] ?? null })}
        className="mt-2 block w-full text-sm"
      />
    </div>
  );
}

export function PrizeListEditor({
  prizes,
  onChange,
}: {
  prizes: PrizeRow[];
  onChange: (prizes: PrizeRow[]) => void;
}) {
  const t = useTranslations("admin");

  function update(index: number, patch: Partial<PrizeRow>) {
    const next = [...prizes];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function add() {
    onChange([...prizes, { name: "", description: "", imageFile: null, qty: "" }]);
  }

  function remove(index: number) {
    onChange(prizes.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {prizes.map((prize, i) => (
        <PrizeRowFields
          key={i}
          prize={prize}
          index={i}
          onUpdate={(patch) => update(i, patch)}
          onRemove={() => remove(i)}
        />
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm font-medium text-brand underline"
      >
        {t("prizeAddPrize")}
      </button>
    </div>
  );
}
