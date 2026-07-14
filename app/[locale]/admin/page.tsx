import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { NewCampaignForm } from "@/components/new-campaign-form";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const [campaigns, individualPosts, submissions] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" } }),
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
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("campaigns")}</h2>
          <NewCampaignForm label={t("newCampaign")} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{c.slug}</td>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c.active ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    {c.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
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

      <section className="mt-10">
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
                  <td className="px-3 py-2">
                    {p.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
