"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

export function NewCampaignForm({ label }: { label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [brandLink, setBrandLink] = useState("");
  const [prizeInfo, setPrizeInfo] = useState("");
  const [termsText, setTermsText] = useState("");
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
        body: JSON.stringify({ slug, name, brandLink, prizeInfo, termsText }),
      });
      if (!res.ok) throw new Error("failed");
      setOpen(false);
      setSlug("");
      setName("");
      setBrandLink("");
      setPrizeInfo("");
      setTermsText("");
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
