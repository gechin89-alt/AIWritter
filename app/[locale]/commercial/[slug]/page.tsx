import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { CommercialFlow } from "@/components/commercial-flow";
import { PrizeCards } from "@/components/prize-cards";

function parseOptions(json: string | null): string[] | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export default async function CommercialCampaignPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tc = await getTranslations("commercial");

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: { prizes: { orderBy: { rank: "asc" } } },
  });
  if (!campaign || !campaign.active) {
    notFound();
  }

  return (
    <div className="relative flex flex-1 flex-col items-center overflow-hidden px-4 py-10 sm:px-6">
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

      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div
          className="px-6 py-10 text-center text-white"
          style={{
            backgroundImage: "linear-gradient(120deg, var(--brand), var(--accent))",
          }}
        >
          <span className="text-4xl">🎁</span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {campaign.name}
          </h1>
        </div>

        <div className="p-6">
          <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
            {campaign.prizeInfo}
          </p>
          <PrizeCards prizes={campaign.prizes} title={tc("prizesTitle")} />
          <details className="mt-6 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
              {tc("terms")}
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-zinc-500 dark:text-zinc-400">
              {campaign.termsText}
            </p>
          </details>
        </div>
      </div>

      <div className="mt-10 w-full max-w-lg">
        <CommercialFlow
          campaignSlug={campaign.slug}
          questionMode={campaign.questionMode}
          identityOptions={parseOptions(campaign.identityOptions)}
          toneOptions={parseOptions(campaign.toneOptions)}
          styleOptions={parseOptions(campaign.styleOptions)}
          identityQuestion={campaign.identityQuestion ?? undefined}
          toneQuestion={campaign.toneQuestion ?? undefined}
          styleQuestion={campaign.styleQuestion ?? undefined}
          identityIncludeOther={campaign.identityIncludeOther}
          toneIncludeOther={campaign.toneIncludeOther}
          styleIncludeOther={campaign.styleIncludeOther}
        />
      </div>
    </div>
  );
}
