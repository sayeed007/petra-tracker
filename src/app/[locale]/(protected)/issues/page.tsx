import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/user";
import { AreaChip, SeverityChip, StatusChip } from "@/components/chips";
import { IssueDrawerHost, OpenIssue } from "@/components/issue-drawer";
import { ListFilters } from "@/components/list-filters";
import { SelectAll } from "@/components/select-all";
import { listActiveDevelopers, listIssues, moduleStats } from "@/lib/issues/data";
import { assignIssues } from "./actions";

type Query = {
  page?: string; status?: string; module?: string; q?: string; side?: string; review?: string;
  denied?: string; missing?: string; bulk?: string; count?: string;
  import?: string; added?: string; moved?: string; kept?: string;
};

export default async function IssuesPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ locale: string }>; searchParams: Promise<Query> }>) {
  const { locale } = await params;
  const query = await searchParams;
  const user = await requireUser(locale);
  const isAdmin = user.role === "admin";
  const [result, developers, stats] = await Promise.all([
    listIssues({
      user,
      page: Number.isFinite(Number(query.page)) ? Number(query.page) : 1,
      status: query.status,
      module: query.module,
      side: query.side,
      q: query.q,
      review: query.review === "1",
    }),
    isAdmin ? listActiveDevelopers() : Promise.resolve([]),
    moduleStats(user),
  ]);
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const issueT = await getTranslations({ locale, namespace: "issue" });
  const statusT = await getTranslations({ locale, namespace: "statuses" });
  const sideT = await getTranslations({ locale, namespace: "sides" });
  const severityT = await getTranslations({ locale, namespace: "severities" });
  const updatedDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const keep = { q: query.q, status: query.status, side: query.side, review: query.review };
  const hrefFor = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...keep, module: query.module, ...overrides })) if (value) next.set(key, value);
    const text = next.toString();
    return text ? `/issues?${text}` : "/issues";
  };
  const totalAll = stats.reduce((sum, row) => sum + row.total, 0);
  const openAll = stats.reduce((sum, row) => sum + row.open, 0);

  return (
    <>
      {query.denied && <p className="notice" role="alert">{t("denied")}</p>}
      {query.missing && <p className="notice" role="alert">{t("missing")}</p>}
      {query.import === "done" && <p className="notice" role="status">{t("importDone", { added: Number(query.added) || 0, moved: Number(query.moved) || 0, kept: Number(query.kept) || 0 })}</p>}
      {query.import === "failed" && <p className="notice" role="alert">{t("importFailed")}</p>}
      {query.bulk === "done" && <p className="notice" role="status">{t("bulkDone", { count: Number(query.count) || 0 })}</p>}
      {query.bulk === "none" && <p className="notice" role="alert">{t("bulkNone")}</p>}
      {query.bulk === "invalid" && <p className="notice" role="alert">{t("bulkInvalid")}</p>}

      <section className="modules" aria-label={t("modulesTitle")}>
        <Link className={`module-card${query.module ? "" : " active"}`} href={hrefFor({ module: undefined, page: undefined })}>
          <span className="module-name">{t("allModulesTile")}</span>
          <strong>{totalAll}</strong>
          <em>{t("moduleOpen", { count: openAll })}</em>
        </Link>
        {stats.map((row) => (
          <Link key={row.module} className={`module-card${query.module === row.module ? " active" : ""}`} href={hrefFor({ module: row.module, page: undefined })}>
            <span className="module-name">{row.module}</span>
            <strong>{row.total}</strong>
            <em>{t("moduleOpen", { count: row.open })}</em>
          </Link>
        ))}
      </section>

      <ListFilters
        q={query.q ?? ""}
        status={query.status ?? ""}
        side={query.side ?? ""}
        module={query.module ?? ""}
        modules={result.modules}
        review={query.review === "1"}
        awaiting={result.awaiting}
        isAdmin={isAdmin}
      />

      {isAdmin && result.issues.length > 0 && (
        <form id="bulk-assign" className="filters" action={assignIssues.bind(null, locale)}>
          <select name="assigneeId" defaultValue="" aria-label={t("assignee")}>
            <option value="">{issueT("unassigned")}</option>
            {developers.map((developer) => <option key={developer.id} value={developer.id}>{developer.name}</option>)}
          </select>
          <button className="button" type="submit">{t("assignSelected")}</button>
        </form>
      )}

      <IssueDrawerHost>
        <div className="tablewrap">
          {result.issues.length === 0 ? <div className="empty">{t("empty")}</div> : (
            <table>
              <thead>
                <tr>
                  {isAdmin && <th><SelectAll label={t("selectAll")} /></th>}
                  <th>{t("issue")}</th><th>{t("module")}</th><th>{t("side")}</th><th>{t("severity")}</th><th>{t("status")}</th><th>{t("assignee")}</th><th>{t("updated")}</th><th />
                </tr>
              </thead>
              <tbody>
                {result.issues.map((issue) => (
                  <tr key={issue.externalId}>
                    {isAdmin && <td><input type="checkbox" name="ids" value={issue.externalId} form="bulk-assign" aria-label={issue.externalId} /></td>}
                    <td><OpenIssue id={issue.externalId} title={issue.title} /><span className="issue-id">{issue.externalId}</span></td>
                    <td>{issue.module}</td>
                    <td><AreaChip side={issue.side} label={sideT(issue.side as "frontend" | "backend" | "both")} /></td>
                    <td><SeverityChip severity={issue.severity} label={severityT(issue.severity as "high" | "medium" | "low" | "unrated")} /></td>
                    <td>
                      <StatusChip status={issue.status} label={statusT(issue.status)} />
                      {issue.pendingStatus && <span className="muted" title={t("pendingTag", { status: statusT(issue.pendingStatus) })}> → {statusT(issue.pendingStatus)}?</span>}
                    </td>
                    <td>{issue.assigneeName || issueT("unassigned")}</td>
                    <td>{updatedDate.format(issue.updatedAt)}</td>
                    <td><Link className="button button-sm" href={`/issues/${encodeURIComponent(issue.externalId)}`}>{t("details")}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </IssueDrawerHost>

      <nav className="pagination" aria-label={t("pagination")}>
        {result.page > 1 ? <Link className="button" href={hrefFor({ page: String(result.page - 1) })}>{t("previous")}</Link> : <span />}
        <span>{t("page", { page: result.page, pages: result.pages })}</span>
        {result.page < result.pages ? <Link className="button" href={hrefFor({ page: String(result.page + 1) })}>{t("next")}</Link> : <span />}
      </nav>
    </>
  );
}
