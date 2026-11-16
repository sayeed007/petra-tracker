"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useListNav } from "@/components/list-busy";
import { PAGE_SIZES } from "@/lib/issues/domain";

type Props = { page: number; pages: number; total: number; size: number };

/** The page numbers to show: the first, the last and a window around the current one, with gaps as null. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => wanted.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => wanted.add(n));
  const list = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  list.forEach((n, index) => {
    if (index > 0 && n - list[index - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

export function Pager({ page, pages, total, size }: Readonly<Props>) {
  const t = useTranslations("dashboard");
  const { navigate } = useListNav();
  const pathname = usePathname();
  const search = useSearchParams();
  const [jump, setJump] = useState("");

  function to(next: { page?: number; size?: number }) {
    const params = new URLSearchParams(search.toString());
    if (next.size !== undefined) {
      if (next.size === 20 || next.size === 100) params.set("size", String(next.size));
      else params.delete("size");
      params.delete("page");
    }
    if (next.page !== undefined) {
      if (next.page <= 1) params.delete("page");
      else params.set("page", String(next.page));
    }
    const query = params.toString();
    navigate(query ? `${pathname}?${query}` : pathname);
  }

  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const last = Math.min(total, page * size);
  const go = () => {
    const wanted = Math.round(Number(jump));
    if (Number.isFinite(wanted) && wanted >= 1) to({ page: Math.min(wanted, pages) });
    setJump("");
  };

  return (
    <nav className="pager" aria-label={t("pagination")}>
      <span className="pager-count">{t("showing", { from, to: last, total })}</span>
      <div className="pager-pages">
        <button type="button" className="button button-sm" disabled={page <= 1} onClick={() => to({ page: 1 })} aria-label={t("firstPage")}>«</button>
        <button type="button" className="button button-sm" disabled={page <= 1} onClick={() => to({ page: page - 1 })} aria-label={t("previous")}>‹</button>
        {pageWindow(page, pages).map((n, index) =>
          n === null ? (
            <span key={`gap-${index}`} className="pager-gap">…</span>
          ) : (
            <button key={n} type="button" className={`button button-sm${n === page ? " button-primary" : ""}`} aria-current={n === page ? "page" : undefined} onClick={() => to({ page: n })}>{n}</button>
          ),
        )}
        <button type="button" className="button button-sm" disabled={page >= pages} onClick={() => to({ page: page + 1 })} aria-label={t("next")}>›</button>
        <button type="button" className="button button-sm" disabled={page >= pages} onClick={() => to({ page: pages })} aria-label={t("lastPage")}>»</button>
      </div>
      <div className="pager-tools">
        <label>
          {t("goToPage")}{" "}
          <input
            type="number"
            min={1}
            max={pages}
            value={jump}
            placeholder={`${page}/${pages}`}
            onChange={(event) => setJump(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") go(); }}
          />
        </label>
        <button type="button" className="button button-sm" onClick={go}>{t("go")}</button>
        <label>
          {t("perPage")}{" "}
          <select value={size} onChange={(event) => to({ size: Number(event.target.value) })}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
    </nav>
  );
}
