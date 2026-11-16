"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { App, Drawer, Spin } from "antd";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BusyLink } from "@/components/list-busy";
import { AreaChip, SeverityChip, StatusChip } from "@/components/chips";
import { updateIssueInline } from "@/app/[locale]/(protected)/issues/actions";
import { ISSUE_STATUSES, type IssueStatus } from "@/lib/issues/domain";

type Detail = {
  externalId: string;
  title: string;
  module: string;
  side: string;
  severity: string;
  status: IssueStatus;
  assigneeName: string;
  details: Record<string, unknown>;
  pendingRequest: { status: IssueStatus; by: string } | null;
};
type Payload = { issue: Detail; role: "admin" | "developer" };

const Opener = createContext<(id: string) => void>(() => undefined);

const text = (value: unknown) => (typeof value === "string" ? value : Array.isArray(value) ? value.map(String).join("\n") : "");

async function fetchIssue(id: string): Promise<Payload> {
  const response = await fetch(`/api/issues/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as Payload;
}

/** Wraps the list: a row's title opens its issue in a right-hand drawer. */
export function IssueDrawerHost({ children }: Readonly<{ children: React.ReactNode }>) {
  const [id, setId] = useState<string | null>(null);
  return (
    <Opener.Provider value={setId}>
      {children}
      <Drawer open={Boolean(id)} onClose={() => setId(null)} placement="right" size={560} destroyOnHidden>
        {id && <DrawerContent key={id} id={id} />}
      </Drawer>
    </Opener.Provider>
  );
}

export function OpenIssue({ id, title }: Readonly<{ id: string; title: string }>) {
  const open = useContext(Opener);
  return <button type="button" className="issue-link linklike" onClick={() => open(id)}>{title}</button>;
}

/** One issue: its details and the form to add an update (no history). Mounted anew for every issue opened. */
function DrawerContent({ id }: Readonly<{ id: string }>) {
  const t = useTranslations("issue");
  const d = useTranslations("drawer");
  const statusT = useTranslations("statuses");
  const sideT = useTranslations("sides");
  const severityT = useTranslations("severities");
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const { message } = App.useApp();
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    let alive = true;
    fetchIssue(id)
      .then((payload) => alive && setData(payload))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    startSaving(async () => {
      const { result } = await updateIssueInline(locale, id, body);
      if (result === "saved" || result === "requested") {
        message.success(result === "requested" ? t("requested") : t("updated"), 4);
        form.reset();
        fetchIssue(id).then(setData).catch(() => undefined);
        router.refresh();
      } else message.error(result === "reason" ? t("reasonNeeded") : result === "conflict" ? t("conflict") : t("invalid"), 5);
    });
  }

  if (failed) return <p className="notice" role="alert">{d("loadError")}</p>;
  if (!data) return <Spin />;

  const { issue, role } = data;
  const rows = (
    [
      [t("owner"), text(issue.details.owner)],
      [t("steps"), text(issue.details.steps)],
      [t("expected"), text(issue.details.expected)],
      [t("actual"), text(issue.details.actual)],
      [t("verify"), text(issue.details.verify)],
      [t("refs"), Array.isArray(issue.details.refs) ? issue.details.refs.map(String).join(", ") : ""],
    ] as [string, string][]
  ).filter(([, value]) => value);

  return (
    <div className="drawer-body">
      <p className="issue-id">{issue.module} · {issue.externalId}</p>
      <h2 className="drawer-title">{issue.title}</h2>
      <div className="chips">
        <StatusChip status={issue.status} label={statusT(issue.status)} />
        <SeverityChip severity={issue.severity} label={severityT(issue.severity as "high" | "medium" | "low" | "unrated")} />
        <AreaChip side={issue.side} label={sideT(issue.side as "frontend" | "backend" | "both")} />
      </div>
      <dl className="detail-list" style={{ marginTop: 14 }}>
        <dt>{t("assignedTo")}</dt>
        <dd>{issue.assigneeName || t("unassigned")}</dd>
        {issue.pendingRequest && (
          <>
            <dt>{d("pending")}</dt>
            <dd>{issue.pendingRequest.by}: {statusT(issue.pendingRequest.status)}</dd>
          </>
        )}
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt>{label}</dt>
            <dd><pre>{value}</pre></dd>
          </div>
        ))}
      </dl>

      <section className="drawer-update">
        <h3>{t("addComment")}</h3>
        <p className="muted">{role === "admin" ? t("closureNote") : t("requestHint")}</p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="drawer-status">{role === "admin" ? t("status") : t("proposeStatus")}</label>
            <select id="drawer-status" name="status" defaultValue="">
              <option value="">{t("keepStatus")} · {statusT(issue.status)}</option>
              {ISSUE_STATUSES.map((item) => <option key={item} value={item}>{statusT(item)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="drawer-comment">{t("comment")}</label>
            <textarea id="drawer-comment" name="comment" required maxLength={4000} placeholder={t("commentPlaceholder")} />
          </div>
          <button className="button button-primary" type="submit" disabled={saving} aria-busy={saving}>{saving && <Spin size="small" className="button-spin" />}{t("save")}</button>
        </form>
      </section>
      <p style={{ marginTop: 18 }}><BusyLink href={`/issues/${encodeURIComponent(issue.externalId)}`}>{d("openFull")}</BusyLink></p>
    </div>
  );
}
