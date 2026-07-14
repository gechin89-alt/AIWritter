"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PlatformToggle } from "./platform-toggle";
import { ChoiceGroup } from "./choice-group";

type Platform = "XHS" | "INSTAGRAM";

export function CommercialFlow({ campaignSlug }: { campaignSlug: string }) {
  const t = useTranslations("individual");
  const tc = useTranslations("commercial");

  const identityOptions = tc.raw("identityOptions") as string[];
  const toneOptions = tc.raw("toneOptions") as string[];
  const styleOptions = tc.raw("styleOptions") as string[];

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPath, setMediaPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  async function uploadMediaIfNeeded(): Promise<string | undefined> {
    if (!mediaFile) return undefined;
    if (mediaPath) return mediaPath;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", mediaFile);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("upload failed");
      const data = await res.json();
      setMediaPath(data.path);
      return data.path as string;
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const resolvedMediaPath = await uploadMediaIfNeeded();
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
          mediaPath: resolvedMediaPath,
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
          mediaPath,
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
      <p className="rounded-lg bg-brand/10 p-4 text-sm text-brand">
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
          className="mt-4 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
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
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
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
      <div className="mt-6 flex flex-col gap-5">
        <div>
          <label className="text-sm font-medium">{tc("stepMedia")}</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setMediaFile(e.target.files?.[0] ?? null);
              setMediaPath(null);
            }}
            className="mt-1 block w-full text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">{tc("identity")}</label>
          <div className="mt-2">
            <ChoiceGroup
              options={identityOptions}
              value={identity}
              onChange={setIdentity}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">{tc("tone")}</label>
          <div className="mt-2">
            <ChoiceGroup options={toneOptions} value={tone} onChange={setTone} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">{tc("style")}</label>
          <div className="mt-2">
            <ChoiceGroup
              options={styleOptions}
              value={style}
              onChange={setStyle}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">{tc("freeText")}</label>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={tc("freeTextPlaceholder")}
            rows={3}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        <div>
          <label className="text-sm font-medium">{t("platform")}</label>
          <div className="mt-2">
            <PlatformToggle value={platform} onChange={setPlatform} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={loading || uploading}
          className="mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading || uploading ? t("generating") : t("generate")}
        </button>
      </div>
    </div>
  );
}
