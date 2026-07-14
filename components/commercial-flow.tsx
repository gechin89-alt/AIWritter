"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Platform = "XHS" | "INSTAGRAM";

export function CommercialFlow({ campaignSlug }: { campaignSlug: string }) {
  const t = useTranslations("individual");
  const tc = useTranslations("commercial");

  const [identity, setIdentity] = useState("");
  const [tone, setTone] = useState("");
  const [style, setStyle] = useState("");
  const [freeText, setFreeText] = useState("");
  const [platform, setPlatform] = useState<Platform>("XHS");

  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [xhsLink, setXhsLink] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          identity,
          tone,
          style,
          freeText,
          commercial: true,
          history: [],
        }),
      });
      if (!res.ok) throw new Error("generate failed");
      const data = await res.json();
      setResult(data.content);
    } catch {
      setError(t("generate") + " — error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmitLink() {
    if (!name.trim() || !phone.trim() || !xhsLink.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignSlug,
          name,
          phone,
          generatedContent: result,
          xhsLink,
        }),
      });
      if (!res.ok) throw new Error("submit failed");
      setSubmitted(true);
    } catch {
      setError(tc("submit") + " — error");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <p className="rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
        {tc("submitted")}
      </p>
    );
  }

  if (result) {
    return (
      <div className="w-full max-w-lg">
        <h2 className="text-xl font-semibold">{t("result")}</h2>
        <div className="mt-4 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          {result}
        </div>
        <button
          onClick={handleCopy}
          className="mt-4 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {copied ? t("copied") : t("copy")}
        </button>

        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">{tc("submitLink")}</h2>
          <div className="mt-3 flex flex-col gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <input
              value={xhsLink}
              onChange={(e) => setXhsLink(e.target.value)}
              placeholder={tc("linkPlaceholder")}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={handleSubmitLink}
              disabled={submitting}
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {tc("submit")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <h2 className="text-xl font-semibold">{tc("questionnaireTitle")}</h2>
      <div className="mt-6 flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium">{t("identity")}</label>
          <input
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            placeholder={t("identityPlaceholder")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t("tone")}</label>
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder={t("tonePlaceholder")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t("style")}</label>
          <input
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder={t("stylePlaceholder")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t("freeText")}</label>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={t("freeTextPlaceholder")}
            rows={4}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="text-sm font-medium">{t("platform")}</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="XHS">Xiaohongshu</option>
            <option value="INSTAGRAM">Instagram</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="mt-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? t("generating") : t("generate")}
        </button>
      </div>
    </div>
  );
}
