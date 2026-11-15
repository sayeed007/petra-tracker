import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/user";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function ProtectedLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const t = await getTranslations({ locale, namespace: "nav" });
  const app = await getTranslations({ locale, namespace: "app" });

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/issues" className="brand">
          <strong>{app("name")}</strong>
          <span>{user.role === "admin" ? t("admin") : user.name}</span>
        </Link>
        <nav className="navlinks" aria-label={t("mainNavigation")}>
          <Link href="/issues">{t("issues")}</Link>
          {user.role === "admin" && <Link href="/developers">{t("developers")}</Link>}
          <Link href="/issues" locale={locale === "en" ? "bn" : "en"} lang={locale === "en" ? "bn" : "en"}>
            {t("switchLanguage")}
          </Link>
          <ThemeToggle />
          <SignOutButton locale={locale} label={t("signOut")} />
        </nav>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
