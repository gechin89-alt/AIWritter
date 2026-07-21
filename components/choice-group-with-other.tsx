"use client";

import { useState } from "react";
import { ChoiceGroup } from "./choice-group";

function splitValues(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export function ChoiceGroupWithOther({
  options,
  otherLabel,
  otherPlaceholder,
  value,
  onChange,
  multiple = false,
}: {
  options: string[];
  /** When provided, an extra "Other" choice is appended that reveals a free-text input. */
  otherLabel?: string;
  otherPlaceholder?: string;
  value: string;
  onChange: (value: string) => void;
  multiple?: boolean;
}) {
  const [isOtherActive, setIsOtherActive] = useState(false);
  const [otherText, setOtherText] = useState("");

  const displayOptions = otherLabel ? [...options, otherLabel] : options;

  function currentOptionPart(): string {
    if (!multiple) return isOtherActive ? "" : value;
    return splitValues(value)
      .filter((v) => options.includes(v))
      .join(", ");
  }

  function commit(optionPart: string, otherActive: boolean, otherValue: string) {
    if (multiple) {
      onChange([optionPart, otherActive ? otherValue : ""].filter(Boolean).join(", "));
    } else {
      onChange(otherActive ? otherValue : optionPart);
    }
  }

  function handleChoiceGroupChange(newValue: string) {
    if (!multiple) {
      if (otherLabel && newValue === otherLabel) {
        setIsOtherActive(true);
        commit("", true, otherText);
      } else {
        setIsOtherActive(false);
        commit(newValue, false, otherText);
      }
      return;
    }

    const parts = splitValues(newValue);
    const otherToggled = otherLabel ? parts.includes(otherLabel) : false;
    setIsOtherActive(otherToggled);
    const optionPart = parts.filter((p) => p !== otherLabel).join(", ");
    commit(optionPart, otherToggled, otherText);
  }

  function handleOtherTextChange(text: string) {
    setOtherText(text);
    commit(currentOptionPart(), true, text);
  }

  const choiceGroupValue = multiple
    ? [currentOptionPart(), isOtherActive && otherLabel ? otherLabel : ""]
        .filter(Boolean)
        .join(", ")
    : isOtherActive
      ? (otherLabel ?? "")
      : value;

  return (
    <div>
      <ChoiceGroup
        options={displayOptions}
        value={choiceGroupValue}
        onChange={handleChoiceGroupChange}
        multiple={multiple}
      />
      {isOtherActive && (
        <input
          value={otherText}
          onChange={(e) => handleOtherTextChange(e.target.value)}
          placeholder={otherPlaceholder}
          className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      )}
    </div>
  );
}
