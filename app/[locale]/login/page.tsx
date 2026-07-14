import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-16">
      <h1 className="mb-8 text-2xl font-semibold">{t("loginTitle")}</h1>
      <AuthForm
        mode="login"
        labels={{
          name: t("name"),
          phone: t("phone"),
          password: t("password"),
          submit: t("submitLogin"),
          error: t("error"),
        }}
      />
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-medium underline">
          {t("submitRegister")}
        </Link>
      </p>
    </div>
  );
}
