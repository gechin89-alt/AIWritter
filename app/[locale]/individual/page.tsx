import { redirect } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/auth";
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

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12 sm:px-6">
      <IndividualFlow />
    </div>
  );
}
