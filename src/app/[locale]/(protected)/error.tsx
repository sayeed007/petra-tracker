"use client";

import { Button } from "antd";
import { useTranslations } from "next-intl";

export default function ProtectedError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const t = useTranslations("common");
  return (
    <section className="panel" role="alert">
      <p>{t("error")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </section>
  );
}
