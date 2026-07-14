import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthForm } from "@/components/auth-form";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-16">
      <h1 className="mb-8 text-2xl font-semibold">{t("registerTitle")}</h1>
      <AuthForm
        mode="register"
        labels={{
          name: t("name"),
          phone: t("phone"),
          password: t("password"),
          submit: t("submitRegister"),
          error: t("error"),
        }}
      />
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium underline">
          {t("submitLogin")}
        </Link>
      </p>
    </div>
  );
}
