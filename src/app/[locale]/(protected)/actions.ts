"use server";

import { signOut } from "@/auth";

export async function signOutAction(locale: string) {
  const safeLocale = locale === "bn" ? "bn" : "en";
  await signOut({ redirectTo: `/${safeLocale}/login` });
}
