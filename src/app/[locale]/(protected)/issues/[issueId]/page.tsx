import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/user";
import { ISSUE_STATUSES } from "@/lib/issues/domain";
import { getIssueDetail, listActiveDevelopers } from "@/lib/issues/data";
import { updateIssue, assignIssue } from "../actions";

function detailText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).join("\n");
  return "";
}

export default async function IssueDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string; issueId: string }>;
  searchParams: Promise<{ updated?: string; assigned?: string; conflict?: string; error?: string; assignment?: string }>;
}>) {
  const { locale, issueId } = await params;
  const query = await searchParams;
  const user = await requireUser(locale);
  const [issue, t, statusT, developerList] = await Promise.all([
    getIssueDetail({ externalId: issueId, user }),
    getTranslations({ locale, namespace: "issue" }),
    getTranslations({ locale, namespace: "statuses" }),
    user.role === "admin" ? listActiveDevelopers() : Promise.resolve([]),
  ]);
  const sideT = await getTranslations({ locale, namespace: "sides" });
  const severityT = await getTranslations({ locale, namespace: "severities" });
  if (!issue) notFound();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const details = issue.details;
  const owner = detailText(details.owner);
  const source = detailText(details.source);
  const evidence = detailText(details.evidence_level);
  const steps = detailText(details.steps);
  const expected = detailText(details.expected);
  const actual = detailText(details.actual);
  const verify = detailText(details.verify);
  const showNote = query.updated || query.assigned || query.conflict || query.error || query.assignment;

  return (
    <>
      <Link href="/issues" className="muted">← {t("back")}</Link>
      <div className="pagehead" style={{ marginTop: 18 }}>
        <div>
          <p className="eyebrow">{issue.module} · {issue.externalId}</p>
          <h1>{issue.title}</h1>
        </div>
        <span className={`tag tag-${issue.status}`}>{statusT(issue.status)}</span>
      </div>

      {showNote && <p className="notice" role="status">
        {query.updated ? t("updated") : query.assigned ? t("assigned") : query.conflict ? t("conflict") : query.assignment ? t("assignmentInvalid") : t("invalid")}
      </p>}

      <div className="detail-grid">
        <section className="panel" aria-labelledby="issue-details-title">
          <h2 id="issue-details-title">{t("details")}</h2>
          <dl className="detail-list">
            <dt>{t("status")}</dt><dd><span className={`tag tag-${issue.status}`}>{statusT(issue.status)}</span></dd>
            <dt>{t("assignedTo")}</dt><dd>{issue.assigneeName || t("unassigned")}</dd>
            <dt>{t("side")}</dt><dd>{sideT(issue.side as "frontend" | "backend" | "both")}</dd>
            <dt>{t("severity")}</dt><dd>{severityT(issue.severity as "high" | "medium" | "low" | "unrated")}</dd>
            {owner && <><dt>{t("owner")}</dt><dd>{owner}</dd></>}
            {source && <><dt>{t("source")}</dt><dd>{source}</dd></>}
            {evidence && <><dt>{t("evidence")}</dt><dd>{evidence}</dd></>}
            {steps && <><dt>{t("steps")}</dt><dd><pre>{steps}</pre></dd></>}
            {expected && <><dt>{t("expected")}</dt><dd><pre>{expected}</pre></dd></>}
            {actual && <><dt>{t("actual")}</dt><dd><pre>{actual}</pre></dd></>}
            {verify && <><dt>{t("verify")}</dt><dd><pre>{verify}</pre></dd></>}
            {Array.isArray(details.refs) && details.refs.length > 0 && <><dt>{t("refs")}</dt><dd>{details.refs.map(String).join(", ")}</dd></>}
          </dl>
        </section>

        <div style={{ display: "grid", gap: 16 }}>
          {user.role === "admin" && (
            <section className="panel">
              <h2>{t("assignedTo")}</h2>
              <form action={assignIssue.bind(null, locale, issue.externalId)}>
                <div className="field">
                  <label htmlFor="assigneeId">{t("assignedTo")}</label>
                  <select id="assigneeId" name="assigneeId" defaultValue={issue.assigneeId}>
                    <option value="">{t("unassigned")}</option>
                    {developerList.map((developer) => <option key={developer.id} value={developer.id}>{developer.name} · {developer.email}</option>)}
                  </select>
                </div>
                <button className="button button-primary" type="submit">{t("assign")}</button>
              </form>
            </section>
          )}
          <section className="panel">
            <h2>{t("addComment")}</h2>
            <p className="muted">{t("closureNote")}</p>
            <form action={updateIssue.bind(null, locale, issue.externalId)}>
              <div className="field">
                <label htmlFor="status">{t("status")}</label>
                <select id="status" name="status" defaultValue="">
                  <option value="">{t("keepStatus")} · {statusT(issue.status)}</option>
                  {ISSUE_STATUSES.map((status) => <option key={status} value={status}>{statusT(status)}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="comment">{t("comment")}</label>
                <textarea id="comment" name="comment" required minLength={1} maxLength={4000} placeholder={t("commentPlaceholder")} />
              </div>
              <button className="button button-primary" type="submit">{t("save")}</button>
            </form>
          </section>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>{t("activity")}</h2>
        {issue.comments.length === 0 ? <p className="muted">{t("noActivity")}</p> : (
          <div className="activity-list">
            {issue.comments.map((comment, index) => (
              <article className="activity" key={`${comment.createdAt.toISOString()}-${index}`}>
                <div className="activity-head">
                  <strong>{comment.author}</strong>
                  <time dateTime={comment.createdAt.toISOString()}>{dateFormat.format(comment.createdAt)}</time>
                </div>
                {comment.statusTo && <span className="tag" style={{ marginTop: 8 }}>
                  {statusT(comment.statusFrom!)} → {statusT(comment.statusTo)}
                </span>}
                <p className="activity-body">{comment.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
