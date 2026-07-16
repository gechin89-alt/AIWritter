import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { CampaignDirectoryList } from "@/components/campaign-directory-list";

export default async function CampaignsDirectoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("directory");

  const campaigns = await prisma.campaign.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: {
      slug: true,
      name: true,
      prizeInfo: true,
      prizes: {
        orderBy: { rank: "asc" },
        select: { id: true, name: true, imagePath: true },
      },
    },
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t("subtitle")}
      </p>
      <div className="mt-8">
        <CampaignDirectoryList
          campaigns={campaigns}
          joinLabel={t("join")}
          emptyLabel={t("empty")}
        />
      </div>
    </div>
  );
}
