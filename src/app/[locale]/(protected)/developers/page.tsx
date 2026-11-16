import { getTranslations } from "next-intl/server";
import { Flash } from "@/components/flash";
import { SubmitButton } from "@/components/list-busy";
import { requireAdmin } from "@/lib/auth/user";
import { listAccessRequests, listDevelopers } from "@/lib/issues/data";
import { createDeveloper, decideAccess, setDeveloperActive, setMemberRole } from "../issues/actions";

export default async function DevelopersPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; created?: string; updated?: string; access?: string; role?: string }>;
}>) {
  const { locale } = await params;
  const me = await requireAdmin(locale);
  const query = await searchParams;
  const [developers, requests, t] = await Promise.all([
    listDevelopers(),
    listAccessRequests(),
    getTranslations({ locale, namespace: "developers" }),
  ]);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const common = await getTranslations({ locale, namespace: "common" });

  return (
    <>
      <div className="pagehead">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1>{t("title")}</h1>
          <p className="page-description">{t("description")}</p>
        </div>
      </div>
      {query.created && <Flash text={t("added")} clear={["created"]} />}
      {query.updated && <Flash text={t("updated")} clear={["updated"]} />}
      {query.access && <Flash text={query.access === "approved" ? t("accessApproved") : t("accessDeclined")} clear={["access"]} />}
      {query.role && <Flash text={query.role === "promoted" ? t("promoted") : t("demoted")} clear={["role"]} />}
      {query.error && <Flash kind="error" text={query.error === "exists" ? t("alreadyExists") : query.error === "invalid" ? t("invalid") : query.error === "self" ? t("notYourself") : common("error")} clear={["error"]} />}
      <section className="panel">
        <h2>{t("add")}</h2>
        <form className="form-grid" action={createDeveloper.bind(null, locale)}>
          <div className="field">
            <label htmlFor="name">{t("name")}</label>
            <input id="name" name="name" required minLength={2} maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="email">{t("email")}</label>
            <input id="email" name="email" type="email" required maxLength={320} />
          </div>
          <SubmitButton className="button button-primary">{t("addButton")}</SubmitButton>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 16 }} aria-labelledby="requests-title">
        <h2 id="requests-title">{t("requests")}</h2>
        <p className="muted">{t("requestsHint")}</p>
        {requests.length === 0 ? <p className="empty">{t("noRequests")}</p> : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>{t("name")}</th><th>{t("email")}</th><th>{t("requestedDate")}</th><th /></tr></thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.name}</td>
                    <td>{request.email}</td>
                    <td>{dateFormat.format(request.requestedAt)}</td>
                    <td>
                      <form action={decideAccess.bind(null, locale, request.id)}>
                        <SubmitButton className="button button-primary" name="decision" value="approve">{t("approveAccess")}</SubmitButton>{" "}
                        <SubmitButton className="button button-danger" name="decision" value="decline">{t("declineAccess")}</SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>{t("list")}</h2>
        {developers.length === 0 ? <p className="empty">{t("noDevelopers")}</p> : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>{t("name")}</th><th>{t("email")}</th><th>{t("role")}</th><th>{t("active")}</th><th>{t("addedDate")}</th><th /></tr></thead>
              <tbody>
                {developers.map((developer) => (
                  <tr key={developer.id}>
                    <td>{developer.name}{developer.id === me.id && <span className="muted"> ({t("you")})</span>}</td>
                    <td>{developer.email}</td>
                    <td><span className={`tag ${developer.role === "admin" ? "tag-open" : ""}`}>{developer.role === "admin" ? t("roleAdmin") : t("roleDeveloper")}</span></td>
                    <td><span className={`tag ${developer.active ? "tag-fixed" : ""}`}>{developer.active ? t("active") : t("inactive")}</span></td>
                    <td>{dateFormat.format(developer.createdAt)}</td>
                    <td>
                      {developer.id !== me.id && (
                        <div className="row-actions">
                          <form action={setMemberRole.bind(null, locale, developer.id)}>
                            <input type="hidden" name="role" value={developer.role === "admin" ? "developer" : "admin"} />
                            <SubmitButton className="button" title={developer.role === "admin" ? t("removeAdminHint") : t("makeAdminHint")}>
                              {developer.role === "admin" ? t("removeAdmin") : t("makeAdmin")}
                            </SubmitButton>
                          </form>
                          <form action={setDeveloperActive.bind(null, locale, developer.id)}>
                            <input type="hidden" name="active" value={String(!developer.active)} />
                            <SubmitButton className={`button ${developer.active ? "button-danger" : ""}`}>
                              {developer.active ? t("deactivate") : t("activate")}
                            </SubmitButton>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
