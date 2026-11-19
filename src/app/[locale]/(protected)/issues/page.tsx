import { IssueList, type Query } from "./issue-list";

export default async function IssuesPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ locale: string }>; searchParams: Promise<Query> }>) {
  const { locale } = await params;
  return <IssueList locale={locale} query={await searchParams} />;
}
