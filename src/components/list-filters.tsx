"use client";

import { useEffect, useRef } from "react";
import { Spin } from "antd";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useListNav } from "@/components/list-busy";
import { ISSUE_STATUSES } from "@/lib/issues/domain";

/** How long typing in the search box may pause before the list reloads (Enter reloads at once). */
export const SEARCH_DEBOUNCE_MS = 3000;

type Filters = { q: string; status: string; side: string; module: string; review: boolean };
type Props = Filters & { size: number; modules: string[]; awaiting: number; isAdmin: boolean };

export function ListFilters({ q, status, side, module, size, modules, review, awaiting, isAdmin }: Readonly<Props>) {
  const t = useTranslations("dashboard");
  const statusT = useTranslations("statuses");
  const sideT = useTranslations("sides");
  const pathname = usePathname();
  const { busy, navigate } = useListNav();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // the latest values, for a search that fires seconds after the keystroke
  const latest = useRef<Filters>({ q, status, side, module, review });
  useEffect(() => {
    latest.current = { q, status, side, module, review };
  });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function go(next: Partial<Filters>) {
    const merged = { ...latest.current, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.status) params.set("status", merged.status);
    if (merged.side) params.set("side", merged.side);
    if (merged.module) params.set("module", merged.module);
    if (merged.review) params.set("review", "1");
    if (size === 20 || size === 100) params.set("size", String(size));
    const query = params.toString();
    navigate(query ? `${pathname}?${query}` : pathname, "replace");
  }

  return (
    <div className="filters" aria-busy={busy}>
      {/* uncontrolled, and re-created when the address changes it (back button, module card) */}
      <input
        key={q}
        type="search"
        defaultValue={q}
        placeholder={t("search")}
        aria-label={t("search")}
        onChange={(event) => {
          const value = event.target.value;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => go({ q: value }), SEARCH_DEBOUNCE_MS);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          if (timer.current) clearTimeout(timer.current);
          go({ q: event.currentTarget.value });
        }}
      />
      <select value={status} aria-label={t("status")} onChange={(event) => go({ status: event.target.value })}>
        <option value="">{t("allStatuses")}</option>
        {ISSUE_STATUSES.map((item) => <option key={item} value={item}>{statusT(item)}</option>)}
      </select>
      <select value={side} aria-label={t("side")} onChange={(event) => go({ side: event.target.value })}>
        <option value="">{t("allAreas")}</option>
        {(["frontend", "backend", "both"] as const).map((item) => <option key={item} value={item}>{sideT(item)}</option>)}
      </select>
      <select value={module} aria-label={t("module")} onChange={(event) => go({ module: event.target.value })}>
        <option value="">{t("allModules")}</option>
        {modules.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      {isAdmin && (
        <button type="button" className={`button${review ? " button-primary" : ""}`} onClick={() => go({ review: !review })}>
          {t("awaitingReview", { count: awaiting })}
        </button>
      )}
      {busy && <Spin size="small" className="filters-spin" />}
    </div>
  );
}
