import { Button } from "antd";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { currentUser } from "@/lib/auth/user";
import { Flash } from "@/components/flash";
import { signInWithGitHub } from "./actions";

export default async function LoginPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}>) {
  const { locale } = await params;
  const query = await searchParams;
  const user = await currentUser();
  if (user) redirect({ href: "/issues", locale });
  const t = await getTranslations({ locale, namespace: "login" });
  const app = await getTranslations({ locale, namespace: "app" });

  return (
    <main className="login-card">
      <Image className="login-logo" src="/brand/petra-tracker-logo.svg" alt="" width={56} height={56} unoptimized priority />
      <p className="eyebrow">{app("name")}</p>
      <h1>{t("title")}</h1>
      <p className="page-description">{t("description")}</p>
      {query.error && <Flash kind="error" text={t("notAllowed")} clear={["error"]} />}
      <form action={signInWithGitHub.bind(null, locale)} style={{ marginTop: 24 }}>
        <Button className="button button-primary" htmlType="submit" block>
          {t("continue")}
        </Button>
      </form>
    </main>
  );
}
