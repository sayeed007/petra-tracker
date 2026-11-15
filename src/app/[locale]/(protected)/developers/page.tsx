import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/user";
import { listDevelopers } from "@/lib/issues/data";
import { createDeveloper, setDeveloperActive } from "../issues/actions";

export default async function DevelopersPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; created?: string; updated?: string }>;
}>) {
  const { locale } = await params;
  await requireAdmin(locale);
  const query = await searchParams;
  const [developers, t] = await Promise.all([
    listDevelopers(),
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
      {query.created && <p className="notice" role="status">{t("added")}</p>}
      {query.updated && <p className="notice" role="status">{t("updated")}</p>}
      {query.error && <p className="notice" role="alert">
        {query.error === "exists" ? t("alreadyExists") : query.error === "invalid" ? t("invalid") : common("error")}
      </p>}
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
          <button className="button button-primary" type="submit">{t("addButton")}</button>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>{t("list")}</h2>
        {developers.length === 0 ? <p className="empty">{t("noDevelopers")}</p> : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>{t("name")}</th><th>{t("email")}</th><th>{t("active")}</th><th>{t("addedDate")}</th><th /></tr></thead>
              <tbody>
                {developers.map((developer) => (
                  <tr key={developer.id}>
                    <td>{developer.name}</td>
                    <td>{developer.email}</td>
                    <td><span className={`tag ${developer.active ? "tag-fixed" : ""}`}>{developer.active ? t("active") : t("inactive")}</span></td>
                    <td>{dateFormat.format(developer.createdAt)}</td>
                    <td>
                      <form action={setDeveloperActive.bind(null, locale, developer.id)}>
                        <input type="hidden" name="active" value={String(!developer.active)} />
                        <button className={`button ${developer.active ? "button-danger" : ""}`} type="submit">
                          {developer.active ? t("deactivate") : t("activate")}
                        </button>
                      </form>
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
