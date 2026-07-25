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

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/individual-posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
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
      <Modal open={open} onClose={() => setOpen(false)} title={t("postHistory")} wide>
        {posts.length === 0 ? (
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
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                    {post.generatedContent}
                  </p>
                </div>
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
