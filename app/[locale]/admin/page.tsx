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
import { CampaignEditForm } from "@/components/campaign-edit-form";
import { CampaignPhotoTest } from "@/components/campaign-photo-test";
import { NotifyUserButton } from "@/components/notify-user-button";
import { UserQuotaEditor } from "@/components/user-quota-editor";
import { effectivePostLimit } from "@/lib/quota";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const td = await getTranslations("directory");
  const tc = await getTranslations("commercial");

  const [campaigns, individualPosts, submissions, allSubmissionKeys, users] =
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
      prisma.user.findMany({
        where: { role: "USER" },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { individualPosts: true } } },
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
    if (s.phone) entry.uniquePhones.add(s.phone);
    statsByCampaign.set(s.campaignId, entry);
  }

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol =
    hdrs.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const baseUrl = `${protocol}://${host}`;

  const campaignQrCodes = new Map(
    await Promise.all(
      campaigns.map(async (c) => {
        const url = `${baseUrl}/${locale}/commercial/${encodeURIComponent(c.slug)}`;
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
        qty: p.qty,
      })),
    }));

  function parseOptions(json: string | null): string[] {
    if (!json) return [];
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  const campaignsTab = (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("campaigns")}</h2>
        <NewCampaignForm label={t("newCampaign")} />
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[760px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[32%]" />
          </colgroup>
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">{t("tableSlug")}</th>
              <th className="px-3 py-2">{t("tableName")}</th>
              <th className="px-3 py-2">{t("tableActive")}</th>
              <th className="px-3 py-2">{t("tableQuestions")}</th>
              <th className="px-3 py-2">{t("totalSubmissions")}</th>
              <th className="px-3 py-2">{t("uniqueParticipants")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const stats = statsByCampaign.get(c.id);
              const qr = campaignQrCodes.get(c.id);
              return (
                <tr key={c.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="truncate px-3 py-2" title={c.slug}>
                    {c.slug}
                  </td>
                  <td className="truncate px-3 py-2" title={c.name}>
                    {c.name}
                  </td>
                  <td className="px-3 py-2">
                    {c.active ? t("tableYes") : t("tableNo")}
                  </td>
                  <td className="px-3 py-2">
                    {c.questionMode === "AI_ADAPTIVE" ? t("modeAi") : t("modeFixed")}
                  </td>
                  <td className="px-3 py-2">{stats?.total ?? 0}</td>
                  <td className="px-3 py-2">{stats?.uniquePhones.size ?? 0}</td>
                  <td className="px-3 py-2">
                    <div className="grid w-fit grid-cols-[repeat(3,auto)] items-center gap-1 sm:flex sm:w-auto sm:flex-wrap sm:gap-1.5">
                      {qr && (
                        <CampaignQr
                          dataUrl={qr.dataUrl}
                          url={qr.url}
                          showLabel={t("showQrCode")}
                          hideLabel={t("hideQrCode")}
                          scanLabel={t("scanToJoin")}
                        />
                      )}
                      {qr && (
                        <CampaignViewButton
                          url={qr.url}
                          label={t("view")}
                          name={c.name}
                          prizeInfo={c.prizeInfo}
                          prizes={c.prizes}
                          termsText={c.termsText}
                          prizesTitle={tc("prizesTitle")}
                          termsTitle={tc("terms")}
                          goToPageLabel={t("viewGoToPage")}
                        />
                      )}
                      <CampaignEditForm
                        campaignId={c.id}
                        initial={{
                          name: c.name,
                          brandLink: c.brandLink,
                          brandColor: c.brandColor,
                          logoPath: c.logoPath,
                          logoWatermarkEnabled: c.logoWatermarkEnabled,
                          productDescription: c.productDescription ?? "",
                          prizeInfo: c.prizeInfo,
                          termsText: c.termsText,
                          questionMode: c.questionMode,
                          identityQuestion: c.identityQuestion ?? "",
                          identityOptions: parseOptions(c.identityOptions),
                          identityIncludeOther: c.identityIncludeOther,
                          identityMultiSelect: c.identityMultiSelect,
                          toneQuestion: c.toneQuestion ?? "",
                          toneOptions: parseOptions(c.toneOptions),
                          toneIncludeOther: c.toneIncludeOther,
                          toneMultiSelect: c.toneMultiSelect,
                          styleQuestion: c.styleQuestion ?? "",
                          styleOptions: parseOptions(c.styleOptions),
                          styleIncludeOther: c.styleIncludeOther,
                          styleMultiSelect: c.styleMultiSelect,
                        }}
                        labels={{
                          edit: t("editCampaign"),
                          save: t("save"),
                          cancel: t("cancel"),
                        }}
                      />
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
                      <CampaignPhotoTest
                        campaignSlug={c.slug}
                        label={t("testPhoto")}
                        labels={{
                          uploadCta: tc("uploadCta"),
                          removePhoto: tc("removePhoto"),
                          run: t("testPhotoRun"),
                          running: t("testPhotoRunning"),
                          result: t("testPhotoResult"),
                          error: t("testPhotoError"),
                          hint: t("testPhotoHint"),
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
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {(() => {
          const total = submissions.length;
          const posted = submissions.filter((s) => s.status === "POSTED").length;
          return t("subSummary", { total, posted, notPosted: total - posted });
        })()}
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">{t("subCampaign")}</th>
              <th className="px-3 py-2">{t("subName")}</th>
              <th className="px-3 py-2">{t("subPhone")}</th>
              <th className="px-3 py-2">{t("subPhoto")}</th>
              <th className="px-3 py-2">{t("subTitle")}</th>
              <th className="px-3 py-2">{t("subLink")}</th>
              <th className="px-3 py-2">{t("subStatus")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => {
              const photoVariants: string[] = s.photoVariants ? JSON.parse(s.photoVariants) : [];
              const titleVariants: string[] = s.titleVariants ? JSON.parse(s.titleVariants) : [];
              const notPosted = s.status !== "POSTED";
              return (
                <tr key={s.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{s.campaign.name}</td>
                  <td className="px-3 py-2">{s.name || "—"}</td>
                  <td className="px-3 py-2">{s.phone || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {(photoVariants.length > 0 ? photoVariants : s.mediaPath ? [s.mediaPath] : []).map(
                        (p) => (
                          <a key={p} href={p} target="_blank" rel="noopener noreferrer">
                            <Image
                              src={p}
                              alt=""
                              width={40}
                              height={40}
                              className={
                                p === s.mediaPath
                                  ? "h-10 w-10 rounded object-cover ring-2 ring-brand"
                                  : "h-10 w-10 rounded object-cover"
                              }
                            />
                          </a>
                        ),
                      )}
                    </div>
                  </td>
                  <td className="max-w-[200px] px-3 py-2">
                    <p className="truncate" title={s.chosenTitle ?? ""}>
                      {s.chosenTitle}
                    </p>
                    {titleVariants.length > 1 && (
                      <p className="text-xs text-zinc-400">
                        {t("subTitleOptionsCount", { count: titleVariants.length })}
                      </p>
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
                  <td className="px-3 py-2">
                    <span
                      className={
                        notPosted
                          ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                          : "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      }
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {notPosted && s.phone && (
                      <NotifyUserButton phone={s.phone} campaignName={s.campaign.name} />
                    )}
                  </td>
                </tr>
              );
            })}
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
              <th className="px-3 py-2">{t("postUser")}</th>
              <th className="px-3 py-2">{t("postPhone")}</th>
              <th className="px-3 py-2">{t("postPlatform")}</th>
              <th className="px-3 py-2">{t("postStatus")}</th>
              <th className="px-3 py-2">{t("postCreated")}</th>
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

  const usersTab = (
    <section>
      <h2 className="text-lg font-semibold">{t("tabUsers")}</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">{t("userName")}</th>
              <th className="px-3 py-2">{t("userPhone")}</th>
              <th className="px-3 py-2">{t("userPostsUsed")}</th>
              <th className="px-3 py-2">{t("userLimit")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2">{u.phone}</td>
                <td className="px-3 py-2">
                  {u._count.individualPosts} / {effectivePostLimit(u.postLimit)}
                </td>
                <td className="px-3 py-2">
                  <UserQuotaEditor userId={u.id} postLimit={u.postLimit} />
                </td>
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
            id: "users",
            label: t("tabUsers"),
            content: usersTab,
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
