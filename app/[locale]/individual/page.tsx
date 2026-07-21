import { redirect } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { effectivePostLimit } from "@/lib/quota";
import { IndividualFlow } from "@/components/individual-flow";

export default async function IndividualPage({
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

  const unlimited = session!.role === "ADMIN";

  const [user, used] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session!.userId },
      select: { postLimit: true },
    }),
    prisma.individualPost.count({ where: { userId: session!.userId } }),
  ]);
  const limit = effectivePostLimit(user?.postLimit ?? null);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12 sm:px-6">
      <IndividualFlow used={used} limit={limit} unlimited={unlimited} />
    </div>
  );
}
