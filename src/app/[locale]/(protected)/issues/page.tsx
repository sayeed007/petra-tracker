import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/user";
import { AreaChip, SeverityChip, StatusChip } from "@/components/chips";
import { IssueDrawerHost, OpenIssue } from "@/components/issue-drawer";
import { Flash } from "@/components/flash";
import { BusyLink, ListBusyArea, RememberListQuery, SubmitButton } from "@/components/list-busy";
import { ListFilters } from "@/components/list-filters";
import { Pager } from "@/components/pager";
import { ReviewRequest } from "@/components/review-request";
import { SelectAll } from "@/components/select-all";
import { listActiveDevelopers, listIssues, moduleStats } from "@/lib/issues/data";
import { listQuery, parsePageSize } from "@/lib/issues/domain";
import { assignIssues } from "./actions";

type Query = {
  page?: string; size?: string; status?: string; module?: string; q?: string; side?: string; review?: string; archived?: string;
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
      size: parsePageSize(query.size),
      q: query.q,
      review: query.review === "1",
      archived: query.archived === "1",
    }),
    isAdmin ? listActiveDevelopers() : Promise.resolve([]),
    moduleStats({ user, status: query.status, side: query.side, q: query.q, review: query.review === "1", archived: query.archived === "1" }),
  ]);
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const issueT = await getTranslations({ locale, namespace: "issue" });
  const statusT = await getTranslations({ locale, namespace: "statuses" });
  const sideT = await getTranslations({ locale, namespace: "sides" });
  const severityT = await getTranslations({ locale, namespace: "severities" });
  const updatedDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const keep = { q: query.q, status: query.status, side: query.side, review: query.review, archived: query.archived, size: query.size };
  const hrefFor = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...keep, module: query.module, ...overrides })) if (value) next.set(key, value);
    const text = next.toString();
    return text ? `/issues?${text}` : "/issues";
  };
  // every module keeps its card (at 0) when the filters leave it empty, so the selected one never disappears
  const counted = new Map(stats.map((row) => [row.module, row]));
  const cards = result.modules.map((module) => counted.get(module) ?? { module, total: 0, open: 0 });
  // the list as it stands (filters, module, page), for the bulk-assign redirect and the detail page's back link
  const current = listQuery(new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string")).toString());
  const totalAll = stats.reduce((sum, row) => sum + row.total, 0);
  const openAll = stats.reduce((sum, row) => sum + row.open, 0);

  return (
    <>
      <RememberListQuery query={current} />
      {query.denied && <Flash kind="error" text={t("denied")} clear={["denied"]} />}
      {query.missing && <Flash kind="error" text={t("missing")} clear={["missing"]} />}
      {query.import === "done" && <Flash text={t("importDone", { added: Number(query.added) || 0, moved: Number(query.moved) || 0, kept: Number(query.kept) || 0 })} clear={["import", "added", "moved", "kept"]} />}
      {query.import === "failed" && <Flash kind="error" text={t("importFailed")} clear={["import"]} />}
      {query.bulk === "done" && <Flash text={t("bulkDone", { count: Number(query.count) || 0 })} clear={["bulk", "count"]} />}
      {query.bulk === "none" && <Flash kind="error" text={t("bulkNone")} clear={["bulk"]} />}
      {query.bulk === "invalid" && <Flash kind="error" text={t("bulkInvalid")} clear={["bulk"]} />}

      <section className="modules" aria-label={t("modulesTitle")}>
        <BusyLink className={`module-card${query.module ? "" : " active"}`} href={hrefFor({ module: undefined, page: undefined })}>
          <span className="module-name">{t("allModulesTile")}</span>
          <strong>{totalAll}</strong>
          <em>{t("moduleOpen", { count: openAll })}</em>
        </BusyLink>
        {cards.map((row) => (
          <BusyLink key={row.module} className={`module-card${query.module === row.module ? " active" : ""}`} href={hrefFor({ module: row.module, page: undefined })}>
            <span className="module-name">{row.module}</span>
            <strong>{row.total}</strong>
            <em>{t("moduleOpen", { count: row.open })}</em>
          </BusyLink>
        ))}
      </section>

      <ListFilters
        q={query.q ?? ""}
        status={query.status ?? ""}
        side={query.side ?? ""}
        module={query.module ?? ""}
        size={result.size}
        modules={result.modules}
        review={query.review === "1"}
        archived={query.archived === "1"}
        awaiting={result.awaiting}
        isAdmin={isAdmin}
      />

      {isAdmin && result.issues.length > 0 && (
        <form id="bulk-assign" className="filters" action={assignIssues.bind(null, locale)}>
          <input type="hidden" name="back" value={current} />
          <select name="assigneeId" defaultValue="" aria-label={t("assignee")}>
            <option value="">{issueT("unassigned")}</option>
            {developers.map((developer) => <option key={developer.id} value={developer.id}>{developer.name}</option>)}
          </select>
          <SubmitButton>{t("assignSelected")}</SubmitButton>
        </form>
      )}

      <ListBusyArea>
      <Pager page={result.page} pages={result.pages} total={result.total} size={result.size} />

      <IssueDrawerHost>
        <div className="tablewrap">
          {result.issues.length === 0 ? <div className="empty">{t("empty")}</div> : (
            <table>
              <thead>
                <tr>
                  {isAdmin && <th><SelectAll label={t("selectAll")} /></th>}
                  <th>{t("sn")}</th><th>{t("issue")}</th><th>{t("module")}</th><th>{t("side")}</th><th>{t("severity")}</th><th>{t("status")}</th><th>{t("assignee")}</th><th>{t("updated")}</th><th />
                </tr>
              </thead>
              <tbody>
                {result.issues.map((issue, index) => (
                  <tr key={issue.externalId}>
                    {isAdmin && <td><input type="checkbox" name="ids" value={issue.externalId} form="bulk-assign" aria-label={issue.externalId} /></td>}
                    <td className="sn">{(result.page - 1) * result.size + index + 1}</td>
                    <td><OpenIssue id={issue.externalId} title={issue.title} /><span className="issue-id">{issue.externalId}</span></td>
                    <td>{issue.module}</td>
                    <td><AreaChip side={issue.side} label={sideT(issue.side as "frontend" | "backend" | "both")} /></td>
                    <td><SeverityChip severity={issue.severity} label={severityT(issue.severity as "high" | "medium" | "low" | "unrated")} /></td>
                    <td>
                      <StatusChip status={issue.status} label={statusT(issue.status)} />
                      {issue.pendingStatus && <span className="muted" title={t("pendingTag", { status: statusT(issue.pendingStatus) })}> → {statusT(issue.pendingStatus)}?</span>}
                      {isAdmin && issue.pendingStatus && (
                        <ReviewRequest
                          id={issue.externalId}
                          title={issue.title}
                          from={statusT(issue.status)}
                          to={statusT(issue.pendingStatus)}
                          by={issue.pendingBy}
                          reason={issue.pendingNote}
                        />
                      )}
                    </td>
                    <td>{issue.assigneeName || issueT("unassigned")}</td>
                    <td>{updatedDate.format(issue.updatedAt)}</td>
                    <td><BusyLink className="button button-sm" href={`/issues/${encodeURIComponent(issue.externalId)}`}>{t("details")}</BusyLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </IssueDrawerHost>

      <Pager page={result.page} pages={result.pages} total={result.total} size={result.size} />
      </ListBusyArea>
    </>
  );
}
