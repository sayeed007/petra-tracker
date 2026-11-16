"use client";

import { useEffect } from "react";
import { App } from "antd";

/**
 * A one-off message from a redirect (?bulk=done and the like): shown as a toast that hides itself,
 * and the given query keys are dropped from the address so a reload does not show it again.
 */
export function Flash({ text, kind = "success", clear }: Readonly<{ text: string; kind?: "success" | "error" | "info"; clear: string[] }>) {
  const { message } = App.useApp();
  useEffect(() => {
    // the keys still in the address mean this redirect has not been shown yet (also guards the dev double effect)
    const url = new URL(window.location.href);
    if (!clear.some((key) => url.searchParams.has(key))) return;
    message.open({ type: kind, content: text, duration: 4, key: text });
    clear.forEach((key) => url.searchParams.delete(key));
    window.history.replaceState(null, "", url);
  }, [message, text, kind, clear]);
  return null;
}
