"use client";

import { App as AntApp, ConfigProvider, theme } from "antd";
import { ThemeProvider, useTheme } from "next-themes";

function ThemedApp({ children }: Readonly<{ children: React.ReactNode }>) {
  const { resolvedTheme } = useTheme();
  return (
    <ConfigProvider
      theme={{
        algorithm: resolvedTheme === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { colorPrimary: "#b42335", borderRadius: 10, fontFamily: "inherit" },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemedApp>{children}</ThemedApp>
    </ThemeProvider>
  );
}
