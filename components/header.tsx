import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { LocaleSwitcher } from "./locale-switcher";
import { LogoutButton } from "./logout-button";

export async function Header() {
  const t = await getTranslations("nav");
  const session = await getSession();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-semibold">
          {t("brand")}
        </Link>
        <nav className="flex items-center gap-4">
          {session?.role === "ADMIN" && (
            <Link href="/admin" className="text-sm font-medium">
              {t("admin")}
            </Link>
          )}
          {session ? (
            <LogoutButton label={t("logout")} />
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium">
                {t("login")}
              </Link>
              <Link href="/register" className="text-sm font-medium">
                {t("register")}
              </Link>
            </>
          )}
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
