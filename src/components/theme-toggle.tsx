"use client";

import { Button } from "antd";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("theme");
  return (
    <Button
      aria-label={resolvedTheme === "dark" ? t("light") : t("dark")}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {resolvedTheme === "dark" ? "☀" : "◐"}
    </Button>
  );
}
