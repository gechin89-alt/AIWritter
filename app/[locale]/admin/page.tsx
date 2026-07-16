import Image from "next/image";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { NewCampaignForm } from "@/components/new-campaign-form";
import { CampaignQr } from "@/components/campaign-qr";
import { CampaignActions } from "@/components/campaign-actions";
import { CampaignDirectoryList } from "@/components/campaign-directory-list";
import { AdminTabs } from "@/components/admin-tabs";
import { CampaignPrizeManager } from "@/components/campaign-prize-manager";
import { CampaignViewButton } from "@/components/campaign-view-button";
import { IconActionButton } from "@/components/icon-action-button";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const td = await getTranslations("directory");

  const [campaigns, individualPosts, submissions, allSubmissionKeys] =
    await Promise.all([
      prisma.campaign.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          prizes: { orderBy: { rank: "asc" } },
        },
      }),
      prisma.individualPost.findMany({
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.commercialSubmission.findMany({
        include: { campaign: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.commercialSubmission.findMany({
        select: { campaignId: true, phone: true },
      }),
    ]);

  const statsByCampaign = new Map<
    string,
    { total: number; uniquePhones: Set<string> }
  >();
  for (const s of allSubmissionKeys) {
    const entry = statsByCampaign.get(s.campaignId) ?? {
      total: 0,
      uniquePhones: new Set<string>(),
    };
    entry.total += 1;
    entry.uniquePhones.add(s.phone);
    statsByCampaign.set(s.campaignId, entry);
  }

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1")
    ? "http"
    : "https";
  const baseUrl = `${protocol}://${host}`;

  const campaignQrCodes = new Map(
    await Promise.all(
      campaigns.map(async (c) => {
        const url = `${baseUrl}/${locale}/commercial/${c.slug}`;
        const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 });
        return [c.id, { url, dataUrl }] as const;
      }),
    ),
  );

  const activeCampaigns = campaigns
    .filter((c) => c.active)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      prizeInfo: c.prizeInfo,
      prizes: c.prizes.map((p) => ({
        id: p.id,
        name: p.name,
        imagePath: p.imagePath,
      })),
    }));

  const campaignsTab = (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("campaigns")}</h2>
        <NewCampaignForm label={t("newCampaign")} />
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Questions</th>
              <th className="px-3 py-2">{t("totalSubmissions")}</th>
              <th className="px-3 py-2">{t("uniqueParticipants")}</th>
              <th className="px-3 py-2">{t("qrCode")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const stats = statsByCampaign.get(c.id);
              const qr = campaignQrCodes.get(c.id);
              return (
                <tr key={c.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{c.slug}</td>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c.active ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    {c.questionMode === "AI_ADAPTIVE" ? "AI" : "Fixed"}
                  </td>
                  <td className="px-3 py-2">{stats?.total ?? 0}</td>
                  <td className="px-3 py-2">{stats?.uniquePhones.size ?? 0}</td>
                  <td className="px-3 py-2">
                    {qr && (
                      <CampaignQr
                        dataUrl={qr.dataUrl}
                        url={qr.url}
                        showLabel={t("showQrCode")}
                        hideLabel={t("hideQrCode")}
                        scanLabel={t("scanToJoin")}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {qr && (
                        <>
                          <CampaignViewButton url={qr.url} label={t("view")} />
                          <IconActionButton
                            icon="📝"
                            label={t("openLive")}
                            href={qr.url}
                            variant="brand"
                          />
                        </>
                      )}
                      <CampaignActions
                        id={c.id}
                        active={c.active}
                        hasSubmissions={(stats?.total ?? 0) > 0}
                        labels={{
                          activate: t("activate"),
                          deactivate: t("deactivate"),
                          deleteLabel: t("delete"),
                          confirmDelete: t("confirmDelete"),
                          cannotDelete: t("cannotDelete"),
                        }}
                      />
                      <CampaignPrizeManager
                        campaignId={c.id}
                        initialPrizes={c.prizes}
                        labels={{
                          manage: t("managePrizes"),
                          save: t("save"),
                          cancel: t("cancel"),
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  const submissionsTab = (
    <section>
      <h2 className="text-lg font-semibold">{t("submissions")}</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Photo</th>
              <th className="px-3 py-2">Link</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">{s.campaign.name}</td>
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2">{s.phone}</td>
                <td className="px-3 py-2">
                  {s.mediaPath && (
                    <a href={s.mediaPath} target="_blank" rel="noopener noreferrer">
                      <Image
                        src={s.mediaPath}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded object-cover"
                      />
                    </a>
                  )}
                </td>
                <td className="px-3 py-2">
                  {s.xhsLink && (
                    <a
                      href={s.xhsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand underline"
                    >
                      {s.xhsLink}
                    </a>
                  )}
                </td>
                <td className="px-3 py-2">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const individualPostsTab = (
    <section>
      <h2 className="text-lg font-semibold">{t("individualPosts")}</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {individualPosts.map((p) => (
              <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">{p.user.name}</td>
                <td className="px-3 py-2">{p.user.phone}</td>
                <td className="px-3 py-2">{p.platform}</td>
                <td className="px-3 py-2">{p.status}</td>
                <td className="px-3 py-2">{p.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const directoryPreviewTab = (
    <section>
      <h2 className="text-lg font-semibold">{t("tabDirectoryPreview")}</h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        /{locale}/campaigns
      </p>
      <div className="mt-4">
        <CampaignDirectoryList
          campaigns={activeCampaigns}
          joinLabel={td("join")}
          emptyLabel={td("empty")}
        />
      </div>
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <AdminTabs
        tabs={[
          { id: "campaigns", label: t("tabCampaigns"), content: campaignsTab },
          {
            id: "submissions",
            label: t("tabSubmissions"),
            content: submissionsTab,
          },
          {
            id: "individualPosts",
            label: t("tabIndividualPosts"),
            content: individualPostsTab,
          },
          {
            id: "directoryPreview",
            label: t("tabDirectoryPreview"),
            content: directoryPreviewTab,
          },
        ]}
      />
    </div>
  );
}
