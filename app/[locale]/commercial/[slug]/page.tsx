import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { CommercialFlow } from "@/components/commercial-flow";

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

  const campaign = await prisma.campaign.findUnique({ where: { slug } });
  if (!campaign || !campaign.active) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold">{campaign.name}</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
          {campaign.prizeInfo}
        </p>
        <details className="mt-4 text-sm text-zinc-500">
          <summary className="cursor-pointer font-medium">
            {tc("terms")}
          </summary>
          <p className="mt-2 whitespace-pre-wrap">{campaign.termsText}</p>
        </details>
      </div>

      <div className="mt-10">
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
