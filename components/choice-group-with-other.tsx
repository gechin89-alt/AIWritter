"use client";

import { useState } from "react";
import { ChoiceGroup } from "./choice-group";

export function ChoiceGroupWithOther({
  options,
  otherLabel,
  otherPlaceholder,
  value,
  onChange,
}: {
  options: string[];
  /** When provided, an extra "Other" choice is appended that reveals a free-text input. */
  otherLabel?: string;
  otherPlaceholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOther, setIsOther] = useState(false);
  const [otherText, setOtherText] = useState("");

  const displayOptions = otherLabel ? [...options, otherLabel] : options;
  const selectedDisplay = isOther ? otherLabel : value;

  function handleSelect(selected: string) {
    if (otherLabel && selected === otherLabel) {
      setIsOther(true);
      onChange(otherText);
    } else {
      setIsOther(false);
      onChange(selected);
    }
  }

  return (
    <div>
      <ChoiceGroup
        options={displayOptions}
        value={selectedDisplay ?? ""}
        onChange={handleSelect}
      />
      {isOther && (
        <input
          value={otherText}
          onChange={(e) => {
            setOtherText(e.target.value);
            onChange(e.target.value);
          }}
          placeholder={otherPlaceholder}
          className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      )}
    </div>
  );
}
