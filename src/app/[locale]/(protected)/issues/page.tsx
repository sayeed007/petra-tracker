import { Tag } from "antd";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/user";
import { SelectAll } from "@/components/select-all";
import { ISSUE_STATUSES } from "@/lib/issues/domain";
import { listActiveDevelopers, listIssues } from "@/lib/issues/data";
import { assignIssues } from "./actions";

export default async function IssuesPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; status?: string; module?: string; q?: string; denied?: string; missing?: string; bulk?: string; count?: string; review?: string }>;
}>) {
  const { locale } = await params;
  const query = await searchParams;
  const user = await requireUser(locale);
  const [result, developers] = await Promise.all([
    listIssues({
      user,
      page: Number.isFinite(Number(query.page)) ? Number(query.page) : 1,
      status: query.status,
      module: query.module,
      q: query.q,
      review: query.review === "1",
    }),
    user.role === "admin" ? listActiveDevelopers() : Promise.resolve([]),
  ]);
  const isAdmin = user.role === "admin";
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const issueT = await getTranslations({ locale, namespace: "issue" });
  const statusT = await getTranslations({ locale, namespace: "statuses" });
  const sideT = await getTranslations({ locale, namespace: "sides" });
  const severityT = await getTranslations({ locale, namespace: "severities" });
  const updatedDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const linkForPage = (page: number) => {
    const next = new URLSearchParams();
    if (query.q) next.set("q", query.q);
    if (query.status) next.set("status", query.status);
    if (query.module) next.set("module", query.module);
    if (query.review) next.set("review", query.review);
    next.set("page", String(page));
    return `/issues?${next.toString()}`;
  };

  return (
    <>
      <div className="pagehead">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1>{t("title")}</h1>
          <p className="page-description">{user.role === "admin" ? t("adminView") : t("developerView")}</p>
        </div>
      </div>
      {query.denied && <p className="notice" role="alert">{t("denied")}</p>}
      {query.missing && <p className="notice" role="alert">{t("missing")}</p>}
      {query.bulk === "done" && <p className="notice" role="status">{t("bulkDone", { count: Number(query.count) || 0 })}</p>}
      {query.bulk === "none" && <p className="notice" role="alert">{t("bulkNone")}</p>}
      {query.bulk === "invalid" && <p className="notice" role="alert">{t("bulkInvalid")}</p>}
      <div className="statrow">
        <div className="stat">{t("total", { count: result.total })}</div>
        <div className="stat">{t("openCount", { count: result.open })}</div>
        {isAdmin && <div className="stat"><Link href="/issues?review=1">{t("awaitingReview", { count: result.awaiting })}</Link></div>}
      </div>
      <form className="filters" method="get" action={`/${locale}/issues`}>
        <input name="q" type="search" placeholder={t("search")} defaultValue={query.q ?? ""} aria-label={t("search")} />
        <select name="status" defaultValue={query.status ?? ""} aria-label={t("status")}>
          <option value="">{t("allStatuses")}</option>
          {ISSUE_STATUSES.map((status) => <option key={status} value={status}>{statusT(status)}</option>)}
        </select>
        <select name="module" defaultValue={query.module ?? ""} aria-label={t("module")}>
          <option value="">{t("allModules")}</option>
          {result.modules.map((module) => <option key={module} value={module}>{module}</option>)}
        </select>
        <button className="button button-primary" type="submit">{t("filter")}</button>
      </form>
      {isAdmin && result.issues.length > 0 && (
        <form id="bulk-assign" className="filters" action={assignIssues.bind(null, locale)}>
          <select name="assigneeId" defaultValue="" aria-label={t("assignee")}>
            <option value="">{issueT("unassigned")}</option>
            {developers.map((developer) => <option key={developer.id} value={developer.id}>{developer.name}</option>)}
          </select>
          <button className="button" type="submit">{t("assignSelected")}</button>
        </form>
      )}
      <div className="tablewrap">
        {result.issues.length === 0 ? <div className="empty">{t("empty")}</div> : (
          <table>
            <thead><tr>{isAdmin && <th><SelectAll label={t("selectAll")} /></th>}<th>{t("issue")}</th><th>{t("module")}</th><th>{t("side")}</th><th>{t("severity")}</th><th>{t("status")}</th><th>{t("assignee")}</th><th>{t("updated")}</th></tr></thead>
            <tbody>
              {result.issues.map((issue) => (
                <tr key={issue.externalId}>
                  {isAdmin && <td><input type="checkbox" name="ids" value={issue.externalId} form="bulk-assign" aria-label={issue.externalId} /></td>}
                  <td><Link className="issue-link" href={`/issues/${encodeURIComponent(issue.externalId)}`}>{issue.title}</Link><span className="issue-id">{issue.externalId}</span></td>
                  <td>{issue.module}</td>
                  <td>{sideT(issue.side as "frontend" | "backend" | "both")}</td>
                  <td><span className={`tag tag-${issue.severity}`}>{severityT(issue.severity as "high" | "medium" | "low" | "unrated")}</span></td>
                  <td><Tag className={`tag tag-${issue.status}`}>{statusT(issue.status)}</Tag>{issue.pendingStatus && <span className="tag" title={t("pendingTag", { status: statusT(issue.pendingStatus) })}> → {statusT(issue.pendingStatus)}?</span>}</td>
                  <td>{issue.assigneeName || issueT("unassigned")}</td>
                  <td>{updatedDate.format(issue.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <nav className="pagination" aria-label={t("pagination")}>
        {result.page > 1 ? <Link className="button" href={linkForPage(result.page - 1)}>{t("previous")}</Link> : <span />}
        <span>{t("page", { page: result.page, pages: result.pages })}</span>
        {result.page < result.pages ? <Link className="button" href={linkForPage(result.page + 1)}>{t("next")}</Link> : <span />}
      </nav>
    </>
  );
}
