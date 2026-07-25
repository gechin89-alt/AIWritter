"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Modal } from "./modal";
import { IconActionButton } from "./icon-action-button";

type Post = {
  id: string;
  mediaPath: string | null;
  generatedContent: string | null;
  platform: string;
  createdAt: string;
};

export function PostHistoryButton() {
  const t = useTranslations("individual");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  function loadPosts() {
    fetch("/api/individual-posts")
      .then((res) => res.json())
      .then((data) => {
        setPosts(data.posts ?? []);
        setLoaded(true);
      });
  }

  function handleOpen() {
    setOpen(true);
    if (!loaded) loadPosts();
  }

  function handleClose() {
    setOpen(false);
    setSelectedPost(null);
  }

  function handleSelectPost(post: Post) {
    setSelectedPost(post);
    setEditText(post.generatedContent ?? "");
    setSaved(false);
    setCopied(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/individual-posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        if (selectedPost?.id === id) setSelectedPost(null);
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveEdit() {
    if (!selectedPost) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/individual-posts/${selectedPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedContent: editText }),
      });
      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) => (p.id === selectedPost.id ? { ...p, generatedContent: editText } : p)),
        );
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(editText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <IconActionButton
        icon="🗂️"
        label={t("postHistory")}
        onClick={handleOpen}
        active={open}
        variant="neutral"
      />
      <Modal open={open} onClose={handleClose} title={t("postHistory")} wide>
        {selectedPost ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setSelectedPost(null)}
              className="w-fit text-xs font-medium text-brand hover:underline"
            >
              {t("postHistoryBack")}
            </button>
            {selectedPost.mediaPath && (
              <Image
                src={selectedPost.mediaPath}
                alt=""
                width={200}
                height={200}
                className="max-h-56 w-auto rounded-lg border border-zinc-200 object-contain dark:border-zinc-800"
              />
            )}
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                {copied ? t("copied") : t("copy")}
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving || editText === selectedPost.generatedContent}
                className="rounded-full border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand/10 disabled:opacity-40"
              >
                {saved ? t("saved") : saving ? t("saving") : t("save")}
              </button>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("postHistoryEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                {post.mediaPath && (
                  <Image
                    src={post.mediaPath}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 rounded-md object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleSelectPost(post)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-zinc-700 hover:text-brand dark:text-zinc-300">
                    {post.generatedContent}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(post.id)}
                  disabled={deletingId === post.id}
                  title={t("postHistoryDelete")}
                  aria-label={t("postHistoryDelete")}
                  className="shrink-0 rounded-full border border-zinc-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-red-950/40"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
