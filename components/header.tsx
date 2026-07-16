import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { LocaleSwitcher } from "./locale-switcher";
import { LogoutButton } from "./logout-button";

function BrandWordmark({ brand }: { brand: string }) {
  const prefix = brand.startsWith("XHS")
    ? "XHS"
    : brand.startsWith("小红书")
      ? "小红书"
      : null;

  if (!prefix) {
    return <span className="text-brand">{brand}</span>;
  }

  return (
    <>
      <span className="text-brand">{prefix}</span>
      <span className="text-zinc-900 dark:text-zinc-50">
        {brand.slice(prefix.length)}
      </span>
    </>
  );
}

export async function Header() {
  const t = await getTranslations("nav");
  const session = await getSession();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-semibold">
          <BrandWordmark brand={t("brand")} />
        </Link>
        <nav className="flex items-center gap-4">
          {session?.role === "ADMIN" && (
            <Link href="/admin" className="text-sm font-medium text-zinc-700 transition-colors hover:text-brand dark:text-zinc-300">
              {t("admin")}
            </Link>
          )}
          {session ? (
            <LogoutButton label={t("logout")} />
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-zinc-700 transition-colors hover:text-brand dark:text-zinc-300">
                {t("login")}
              </Link>
              <Link href="/register" className="text-sm font-medium text-zinc-700 transition-colors hover:text-brand dark:text-zinc-300">
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
