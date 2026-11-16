import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const STATES = ["waiting", "declined", "disabled"] as const;

export default async function AccessRequestedPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ state?: string }>;
}>) {
  const { locale } = await params;
  const { state } = await searchParams;
  const t = await getTranslations({ locale, namespace: "access" });
  const key = STATES.find((candidate) => candidate === state) ?? "waiting";

  return (
    <main className="login-card">
      <Image className="login-logo" src="/brand/petra-tracker-logo.svg" alt="" width={56} height={56} unoptimized priority />
      <h1>{t(`${key}Title`)}</h1>
      <p className="page-description">{t(`${key}Body`)}</p>
      <p style={{ marginTop: 24 }}>
        <Link className="button" href="/login">{t("back")}</Link>
      </p>
    </main>
  );
}
