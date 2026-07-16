import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { WelcomeSplash } from "@/components/welcome-splash";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-16 sm:px-6">
      <WelcomeSplash />
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </div>

      <div className="mt-12 grid w-full max-w-4xl gap-6 sm:grid-cols-2">
        <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="h-1.5 bg-accent" />
          <div className="flex flex-1 flex-col p-6">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {t("individualTitle")}
            </h2>
            <p className="mt-2 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
              {t("individualDesc")}
            </p>
            <Link
              href="/individual"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
            >
              {t("individualCta")}
            </Link>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="h-1.5 bg-brand" />
          <div className="flex flex-1 flex-col p-6">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {t("commercialTitle")}
            </h2>
            <p className="mt-2 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
              {t("commercialDesc")}
            </p>
            <Link
              href="/commercial/demo"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              {t("commercialCta")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
