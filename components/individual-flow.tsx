"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PlatformToggle } from "./platform-toggle";
import { ChoiceGroup } from "./choice-group";

type ChatTurn = { role: "user" | "assistant"; content: string };
type Platform = "XHS" | "INSTAGRAM";

export function IndividualFlow() {
  const t = useTranslations("individual");

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
  const [platform, setPlatform] = useState<Platform>("XHS");

  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [clarifyAnswer, setClarifyAnswer] = useState("");

  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(
    () => (mediaFile ? URL.createObjectURL(mediaFile) : null),
    [mediaFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
        }),
      });
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
      setError(t("generate") + " — error");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
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
        <button
          onClick={handleClarifySubmit}
          disabled={loading}
          className="mt-3 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? t("generating") : t("generate")}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <div className="mt-6 flex flex-col gap-5">
        <div>
          <label className="text-sm font-medium">{t("stepMedia")}</label>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => {
              setMediaFile(e.target.files?.[0] ?? null);
              setMediaPath(null);
            }}
            className="mt-1 block w-full text-sm"
          />
          {previewUrl && mediaFile && (
            <div className="mt-3">
              {mediaFile.type.startsWith("video/") ? (
                <video
                  src={previewUrl}
                  controls
                  className="max-h-64 rounded-lg border border-zinc-200 dark:border-zinc-800"
                />
              ) : (
                // Local blob preview — next/image can't optimize blob: URLs
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt=""
                  className="max-h-64 rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
                />
              )}
            </div>
          )}
        </div>

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
