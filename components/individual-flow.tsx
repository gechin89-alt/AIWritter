"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ChoiceGroup } from "./choice-group";
import { MediaUploadField } from "./media-upload-field";
import { BrandProfileEditor } from "./brand-profile-editor";

type ChatTurn = { role: "user" | "assistant"; content: string };

export function IndividualFlow({
  used,
  limit,
  unlimited = false,
}: {
  used: number;
  limit: number;
  unlimited?: boolean;
}) {
  const t = useTranslations("individual");
  const locale = useLocale();
  const router = useRouter();
  const remaining = Math.max(0, limit - used);

  const identityOptions = t.raw("identityOptions") as string[];
  const toneOptions = t.raw("toneOptions") as string[];
  const styleOptions = t.raw("styleOptions") as string[];

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPath, setMediaPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [identity, setIdentity] = useState("");
  const [tone, setTone] = useState("");
  const [style, setStyle] = useState("");
  const [freeText, setFreeText] = useState("");
  // Instagram support is hidden for now — XHS only.
  const platform = "XHS" as const;

  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [clarifyAnswer, setClarifyAnswer] = useState("");

  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);

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

  async function callGenerate(nextHistory: ChatTurn[], resolvedMediaPath?: string) {
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
          mediaPath: resolvedMediaPath ?? mediaPath ?? undefined,
          history: nextHistory,
          locale,
        }),
      });
      if (res.status === 402) {
        router.push("/upgrade");
        return;
      }
      if (res.status === 503) {
        setAiUnavailable(true);
        setError(unlimited ? t("aiUnavailableAdmin") : t("aiUnavailable"));
        return;
      }
      if (!res.ok) throw new Error("generate failed");
      const data = await res.json();
      if (data.type === "question") {
        setPendingQuestion(data.content);
        setHistory([...nextHistory, { role: "assistant", content: data.content }]);
      } else {
        setPendingQuestion(null);
        setResult(data.content);
      }
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!unlimited && remaining <= 0) {
      router.push("/upgrade");
      return;
    }
    const path = await uploadMediaIfNeeded();
    await callGenerate([], path);
  }

  async function handleClarifySubmit() {
    if (!clarifyAnswer.trim()) return;
    const nextHistory: ChatTurn[] = [
      ...history,
      { role: "user", content: clarifyAnswer },
    ];
    setClarifyAnswer("");
    await callGenerate(nextHistory);
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (result) {
    const isVideo = mediaFile?.type.startsWith("video/") ?? false;
    return (
      <div className="w-full max-w-lg">
        <h2 className="text-xl font-semibold">{t("result")}</h2>
        {mediaPath &&
          (isVideo ? (
            <video
              src={mediaPath}
              controls
              className="mt-4 max-h-72 w-auto rounded-lg border border-zinc-200 dark:border-zinc-800"
            />
          ) : (
            <Image
              src={mediaPath}
              alt=""
              width={240}
              height={240}
              className="mt-4 max-h-72 w-auto rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
            />
          ))}
        <div className="mt-4 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          {result}
        </div>
        <button
          onClick={handleCopy}
          className="mt-4 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
    );
  }

  if (pendingQuestion) {
    return (
      <div className="w-full max-w-lg">
        <h2 className="text-lg font-semibold">{t("clarifyTitle")}</h2>
        <p className="mt-3 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
          {pendingQuestion}
        </p>
        <textarea
          value={clarifyAnswer}
          onChange={(e) => setClarifyAnswer(e.target.value)}
          rows={3}
          className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          onClick={handleClarifySubmit}
          disabled={loading || aiUnavailable}
          className={
            aiUnavailable
              ? "mt-3 rounded-full bg-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
              : "mt-3 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          }
        >
          {loading ? t("generating") : t("generate")}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <BrandProfileEditor />
      </div>
      <p
        className={`mt-2 text-sm ${!unlimited && remaining <= 0 ? "text-red-600" : "text-zinc-500 dark:text-zinc-400"}`}
      >
        {unlimited ? t("quotaUnlimited") : t("quotaRemaining", { count: remaining })}
      </p>

      <div className="mt-6 flex flex-col gap-5">
        <MediaUploadField
          label={t("stepMedia")}
          file={mediaFile}
          onChange={(file) => {
            setMediaFile(file);
            setMediaPath(null);
          }}
          accept="image/*,video/*"
          uploadLabel={t("uploadCta")}
          removeLabel={t("removePhoto")}
        />

        <div>
          <label className="text-sm font-medium">{t("identity")}</label>
          <div className="mt-2">
            <ChoiceGroup
              options={identityOptions}
              value={identity}
              onChange={setIdentity}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">{t("tone")}</label>
          <div className="mt-2">
            <ChoiceGroup options={toneOptions} value={tone} onChange={setTone} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">{t("style")}</label>
          <div className="mt-2">
            <ChoiceGroup options={styleOptions} value={style} onChange={setStyle} />
          </div>
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={loading || uploading || aiUnavailable}
          className={
            aiUnavailable
              ? "mt-2 rounded-full bg-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
              : "mt-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          }
        >
          {loading || uploading ? t("generating") : t("generate")}
        </button>
      </div>
    </div>
  );
}
