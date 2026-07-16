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

  const steps = [
    { icon: "📸", title: t("step1Title"), desc: t("step1Desc") },
    { icon: "💬", title: t("step2Title"), desc: t("step2Desc") },
    { icon: "🚀", title: t("step3Title"), desc: t("step3Desc") },
  ];

  return (
    <div className="flex flex-1 flex-col items-center">
      <WelcomeSplash />

      <div className="relative w-full overflow-hidden px-4 py-20 sm:px-6">
        <div
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl"
          aria-hidden
        >
          <div
            className="h-80 w-[36rem] opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(120deg, var(--brand), var(--accent))",
            }}
          />
        </div>

        <div className="mx-auto w-full max-w-4xl text-center">
          <span className="inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            ✨ {t("badge")}
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="w-full max-w-4xl px-4 pb-4 sm:px-6">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("howItWorksTitle")}
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent text-2xl shadow-sm">
                {step.icon}
              </div>
              <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {step.title}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-4xl px-4 py-16 sm:px-6">
        <div className="grid w-full gap-6 sm:grid-cols-2">
          <div className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
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

          <div className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            <div className="h-1.5 bg-brand" />
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {t("commercialTitle")}
              </h2>
              <p className="mt-2 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t("commercialDesc")}
              </p>
              <Link
                href="/campaigns"
                className="mt-6 inline-flex items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              >
                {t("commercialCta")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
