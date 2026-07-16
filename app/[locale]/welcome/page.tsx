"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { SplashScreen } from "@/components/splash-screen";

export default function WelcomePage() {
  const t = useTranslations("home");
  const tn = useTranslations("nav");
  const router = useRouter();

  return (
    <SplashScreen
      onEnter={() => router.push("/")}
      ctaLabel={t("enterCta")}
      brand={tn("brand")}
      tagline={t("subtitle")}
    />
  );
}
