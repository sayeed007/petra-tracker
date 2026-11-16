"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, useTransition } from "react";
import { Spin } from "antd";
import { useFormStatus } from "react-dom";
import { Link, useRouter } from "@/i18n/navigation";

type Navigate = (href: string, mode?: "push" | "replace") => void;
const NavBusy = createContext<{ busy: boolean; navigate: Navigate } | null>(null);

/**
 * One pending state for the signed-in pages: links, filters and the pager navigate through it,
 * a thin bar runs across the top while the next page loads, and the issue list dims under a spinner.
 */
export function ListBusyProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const navigate: Navigate = (href, mode = "push") => startTransition(() => (mode === "replace" ? router.replace(href) : router.push(href)));
  return (
    <NavBusy.Provider value={{ busy, navigate }}>
      {busy && <div className="nav-progress" role="progressbar" aria-busy="true" />}
      {children}
    </NavBusy.Provider>
  );
}

/** Navigation that drives the loader; falls back to the plain router outside the provider. */
export function useListNav() {
  const context = useContext(NavBusy);
  const router = useRouter();
  return context ?? {
    busy: false,
    navigate: ((href, mode = "push") => (mode === "replace" ? router.replace(href) : router.push(href))) as Navigate,
  };
}

/** Covers its children with a spinner while the next page loads. */
export function ListBusyArea({ children }: Readonly<{ children: React.ReactNode }>) {
  const { busy } = useListNav();
  return <Spin spinning={busy} delay={150} size="large">{children}</Spin>;
}

/** A link that goes through the shared transition, so the loader shows; modified clicks (new tab) stay native. */
export function BusyLink({ href, className, children }: Readonly<{ href: string; className?: string; children: React.ReactNode }>) {
  const { navigate } = useListNav();
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </Link>
  );
}

/** A submit button that shows a spinner and stays disabled while its form's server action runs. */
export function SubmitButton({ className = "button", name, value, title, children }: Readonly<{
  className?: string; name?: string; value?: string; title?: string; children: React.ReactNode;
}>) {
  const { pending, data } = useFormStatus();
  // with two buttons in one form (approve / decline) only the pressed one spins
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button className={className} type="submit" name={name} value={value} title={title} disabled={pending} aria-busy={mine}>
      {mine && <Spin size="small" className="button-spin" />}
      {children}
    </button>
  );
}

const LIST_KEY = "petra-tracker:list-query";

/** Remembers the list's filters for this tab, so leaving the list and coming back keeps them. */
export function RememberListQuery({ query }: Readonly<{ query: string }>) {
  useEffect(() => {
    try { sessionStorage.setItem(LIST_KEY, query); } catch { /* storage off: the link simply opens the plain list */ }
  }, [query]);
  return null;
}

const noSubscribe = () => () => undefined;
function readListQuery() {
  try { return sessionStorage.getItem(LIST_KEY) ?? ""; } catch { return ""; }
}

/** "Back to the list" that returns to the filters the list had. */
export function BackToList({ className, children }: Readonly<{ className?: string; children: React.ReactNode }>) {
  const query = useSyncExternalStore(noSubscribe, readListQuery, () => "");
  return <BusyLink href={query ? `/issues?${query}` : "/issues"} className={className}>{children}</BusyLink>;
}
