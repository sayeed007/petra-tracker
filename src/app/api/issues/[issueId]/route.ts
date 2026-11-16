import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/user";
import { getIssueDetail } from "@/lib/issues/data";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** One issue for the list's drawer. A developer only gets the issues assigned to them; the activity history is left out. */
export async function GET(_request: Request, { params }: Readonly<{ params: Promise<{ issueId: string }> }>) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { issueId } = await params;
  const issue = await getIssueDetail({ externalId: safeDecode(issueId), user });
  if (!issue) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const { comments: _history, ...rest } = issue;
  void _history;
  return NextResponse.json({ issue: rest, role: user.role }, { headers: { "Cache-Control": "no-store" } });
}
