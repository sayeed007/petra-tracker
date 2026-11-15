"use server";

import { signIn } from "@/auth";

export async function signInWithGitHub(locale: string) {
  const safeLocale = locale === "bn" ? "bn" : "en";
  await signIn("github", { redirectTo: `/${safeLocale}/issues` });
}
