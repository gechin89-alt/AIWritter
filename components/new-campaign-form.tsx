"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

function parseOptions(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export function NewCampaignForm({ label }: { label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [brandLink, setBrandLink] = useState("");
  const [prizeInfo, setPrizeInfo] = useState("");
  const [termsText, setTermsText] = useState("");
  const [identityOptions, setIdentityOptions] = useState("");
  const [toneOptions, setToneOptions] = useState("");
  const [styleOptions, setStyleOptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name,
          brandLink,
          prizeInfo,
          termsText,
          identityOptions: parseOptions(identityOptions),
          toneOptions: parseOptions(toneOptions),
          styleOptions: parseOptions(styleOptions),
        }),
      });
      if (!res.ok) throw new Error("failed");
      setOpen(false);
      setSlug("");
      setName("");
      setBrandLink("");
      setPrizeInfo("");
      setTermsText("");
      setIdentityOptions("");
      setToneOptions("");
      setStyleOptions("");
      router.refresh();
    } catch {
      setError("Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        {label}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <input
        required
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="slug (e.g. summer-launch)"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Campaign name"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        required
        value={brandLink}
        onChange={(e) => setBrandLink(e.target.value)}
        placeholder="Brand product link"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <textarea
        value={prizeInfo}
        onChange={(e) => setPrizeInfo(e.target.value)}
        placeholder="Prize info"
        rows={2}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <textarea
        value={termsText}
        onChange={(e) => setTermsText(e.target.value)}
        placeholder="Terms & conditions"
        rows={2}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      <div className="mt-1 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
        Optional: customize the questionnaire choices for this campaign
        (comma-separated). Leave blank to use the default options.
      </div>
      <input
        value={identityOptions}
        onChange={(e) => setIdentityOptions(e.target.value)}
        placeholder="Identity options, e.g. 真实分享者, 专业测评者, 生活记录者"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        value={toneOptions}
        onChange={(e) => setToneOptions(e.target.value)}
        placeholder="Tone options, e.g. 真诚, 活泼, 专业"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        value={styleOptions}
        onChange={(e) => setStyleOptions(e.target.value)}
        placeholder="Style options, e.g. 简约, 故事叙述, 种草安利"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
