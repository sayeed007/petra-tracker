import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("issue");
  return <main className="login-card"><h1>404</h1><p>{t("notFound")}</p><Link href="/issues">{t("back")}</Link></main>;
}
