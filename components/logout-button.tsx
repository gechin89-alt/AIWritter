"use client";

import { useRouter } from "@/i18n/navigation";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      {label}
    </button>
  );
}
