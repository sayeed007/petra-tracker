import { IssueList, type Query } from "../issues/issue-list";

export default async function ArchivePage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ locale: string }>; searchParams: Promise<Query> }>) {
  const { locale } = await params;
  return <IssueList locale={locale} query={await searchParams} archived />;
}
