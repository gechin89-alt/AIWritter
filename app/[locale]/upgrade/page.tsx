import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { effectivePostLimit } from "@/lib/quota";

export default async function UpgradePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect({ href: "/login", locale });
  }

  const t = await getTranslations("upgrade");

  const [user, used] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session!.userId },
      select: { postLimit: true },
    }),
    prisma.individualPost.count({ where: { userId: session!.userId } }),
  ]);
  const limit = effectivePostLimit(user?.postLimit ?? null);

  return (
    <div className="relative flex flex-1 flex-col items-center overflow-hidden px-4 py-16 sm:px-6">
      <div
        className="pointer-events-none absolute inset-x-0 -top-20 -z-10 flex justify-center blur-3xl"
        aria-hidden
      >
        <div
          className="h-64 w-[28rem] opacity-20"
          style={{
            backgroundImage: "linear-gradient(120deg, var(--brand), var(--accent))",
          }}
        />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <span className="text-4xl">🔒</span>
        <h1 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("usageLabel", { used, limit })}
        </p>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
        <span className="mt-4 inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          {t("comingSoon")}
        </span>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            {t("backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
