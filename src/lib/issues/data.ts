import { ObjectId, type Filter } from "mongodb";
import { archiveCutoff, CLOSED_STATUSES, DEFAULT_PAGE_SIZE, ISSUE_STATUSES, SEVERITY_ORDER, STATUS_ORDER, type IssueStatus } from "./domain";
import { getDb } from "@/lib/db";
import type { CommentDocument, IssueDocument, UserDocument } from "@/lib/db/types";

const regexEscape = (value: string) => Array.from(value, (char) => ".*+?^$()|[]{}\\".includes(char) ? String.fromCharCode(92) + char : char).join("");

export type IssueListRow = {
  externalId: string;
  title: string;
  module: string;
  side: string;
  severity: string;
  status: IssueStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  /** The status a developer has asked for and an administrator has not yet decided. */
  pendingStatus: IssueStatus | null;
  /** Who asked for pendingStatus, and the reason they wrote with it. */
  pendingBy: string | null;
  pendingNote: string | null;
  updatedAt: Date;
};

type FilterInput = {
  user: { id: string; role: "admin" | "developer" };
  status?: string;
  q?: string;
  side?: string;
  review?: boolean;
  /** True lists the archive (closed and untouched for two days); otherwise the archive is left out. */
  archived?: boolean;
};

/** The list filters other than the module: the module cards count with these, the list adds the module on top. */
function issueFilter(input: FilterInput): Filter<IssueDocument> {
  const filter: Filter<IssueDocument> = input.user.role === "admin"
    ? {}
    : { assigneeId: new ObjectId(input.user.id) };
  if (input.status && ISSUE_STATUSES.includes(input.status as IssueStatus)) {
    filter.status = input.status as IssueStatus;
  }
  const cutoff = archiveCutoff();
  if (input.archived) {
    filter.status = filter.status && CLOSED_STATUSES.includes(filter.status as IssueStatus) ? filter.status : { $in: [...CLOSED_STATUSES] };
    filter.updatedAt = { $lte: cutoff };
  } else {
    filter.$nor = [{ status: { $in: [...CLOSED_STATUSES] }, updatedAt: { $lte: cutoff } }];
  }
  if (input.side && ["frontend", "backend", "both"].includes(input.side)) filter.side = input.side;
  if (input.review && input.user.role === "admin") filter.pendingRequest = { $type: "object" };
  const query = input.q?.trim().slice(0, 100);
  if (query) {
    const safe = new RegExp(regexEscape(query), "i");
    filter.$or = [{ externalId: safe }, { title: safe }];
  }
  return filter;
}

export async function listIssues(input: {
  user: { id: string; role: "admin" | "developer" };
  page: number;
  status?: string;
  module?: string;
  q?: string;
  /** Rows per page (see PAGE_SIZES). */
  size?: number;
  /** frontend, backend or both. */
  side?: string;
  /** Administrators only: just the issues with a waiting status request. */
  review?: boolean;
  /** The archive: closed issues nobody has touched for two days. */
  archived?: boolean;
}) {
  const database = await getDb();
  const collection = database.collection<IssueDocument>("issues");
  const filter = issueFilter(input);
  if (input.module) filter.module = input.module;

  const total = await collection.countDocuments(filter);
  const awaiting = input.user.role === "admin"
    ? await collection.countDocuments({ pendingRequest: { $type: "object" } })
    : 0;
  const size = input.size ?? DEFAULT_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.max(1, Math.min(input.page, pages));
  // Still-bug first, then open, in progress, decisions ... finished work last; inside a status the high severity first,
  // then module and id so the order never shifts between pages. An unknown value sorts last.
  const rank = (field: string, order: readonly string[]) => ({
    $let: { vars: { at: { $indexOfArray: [order, field] } }, in: { $cond: [{ $lt: ["$$at", 0] }, order.length, "$$at"] } },
  });
  const rows = await collection.aggregate<IssueDocument>([
    { $match: filter },
    { $addFields: { statusRank: rank("$status", STATUS_ORDER), severityRank: rank("$severity", SEVERITY_ORDER) } },
    { $sort: { statusRank: 1, severityRank: 1, module: 1, externalId: 1 } },
    { $skip: (page - 1) * size },
    { $limit: size },
  ]).toArray();
  const peopleIds = rows.flatMap((issue) => [issue.assigneeId, issue.pendingRequest?.by].filter((id): id is ObjectId => Boolean(id)));
  const developers = peopleIds.length
    ? await database.collection<UserDocument>("users").find({ _id: { $in: peopleIds } }).project({ name: 1 }).toArray()
    : [];
  const names = new Map(developers.map((developer) => [developer._id.toHexString(), developer.name]));
  // the reason a developer gave with a waiting request, for the review popup in the list
  const requestIds = rows.flatMap((issue) => issue.pendingRequest ? [issue.pendingRequest.commentId] : []);
  const requests = requestIds.length
    ? await database.collection<CommentDocument>("comments").find({ _id: { $in: requestIds } }).project<Pick<CommentDocument, "_id" | "body">>({ body: 1 }).toArray()
    : [];
  const reasons = new Map(requests.map((request) => [request._id.toHexString(), request.body]));
  const modules = await collection.distinct("module", input.user.role === "admin" ? {} : { assigneeId: new ObjectId(input.user.id) });

  return {
    issues: rows.map((issue): IssueListRow => ({
      externalId: issue.externalId,
      title: issue.title,
      module: issue.module,
      side: issue.side,
      severity: issue.severity,
      status: issue.status,
      assigneeId: issue.assigneeId?.toHexString() ?? null,
      assigneeName: issue.assigneeId ? names.get(issue.assigneeId.toHexString()) ?? null : null,
      pendingStatus: issue.pendingRequest?.status ?? null,
      pendingBy: issue.pendingRequest ? names.get(issue.pendingRequest.by.toHexString()) ?? null : null,
      pendingNote: issue.pendingRequest ? reasons.get(issue.pendingRequest.commentId.toHexString()) ?? null : null,
      updatedAt: issue.updatedAt,
    })),
    total,
    awaiting,
    size,
    pages,
    page,
    modules: modules.sort(),
  };
}

export async function getIssueDetail(input: {
  externalId: string;
  user: { id: string; role: "admin" | "developer" };
}) {
  const database = await getDb();
  const filter: Filter<IssueDocument> = { externalId: input.externalId };
  if (input.user.role !== "admin") filter.assigneeId = new ObjectId(input.user.id);
  const issue = await database.collection<IssueDocument>("issues").findOne(filter);
  if (!issue) return null;

  const comments = await database.collection<CommentDocument>("comments")
    .find({ issueId: issue._id })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
  const authorIds = comments.flatMap((comment) => comment.authorId ? [comment.authorId] : []);
  const authors = authorIds.length
    ? await database.collection<UserDocument>("users").find({ _id: { $in: authorIds } }).project({ name: 1 }).toArray()
    : [];
  const names = new Map(authors.map((author) => [author._id.toHexString(), author.name]));
  const assignee = issue.assigneeId
    ? await database.collection<UserDocument>("users").findOne({ _id: issue.assigneeId })
    : null;

  return {
    externalId: issue.externalId,
    title: issue.title,
    module: issue.module,
    side: issue.side,
    severity: issue.severity,
    status: issue.status,
    assigneeId: issue.assigneeId?.toHexString() ?? "",
    assigneeName: assignee?.name ?? "",
    details: issue.details,
    updatedAt: issue.updatedAt,
    pendingRequest: issue.pendingRequest
      ? { status: issue.pendingRequest.status, by: names.get(issue.pendingRequest.by.toHexString()) ?? "", at: issue.pendingRequest.at }
      : null,
    comments: comments.map((comment) => ({
      request: comment.kind === "request",
      requestedStatus: comment.requestedStatus ?? null,
      decision: comment.decision ?? null,
      decisionNote: comment.decisionNote ?? null,
      body: comment.body,
      system: comment.kind === "system" || !comment.authorId,
      author: comment.authorId ? names.get(comment.authorId.toHexString()) ?? "Former developer" : "",
      createdAt: comment.createdAt,
      statusFrom: comment.statusFrom,
      statusTo: comment.statusTo,
    })),
  };
}

export async function listActiveDevelopers() {
  const database = await getDb();
  const developers = await database.collection<UserDocument>("users")
    // administrators can be given work too (a promoted lead keeps their tasks)
    .find({ role: { $in: ["developer", "admin"] }, active: true })
    .sort({ name: 1 })
    .toArray();
  return developers.map((developer) => ({
    id: developer._id.toHexString(),
    name: developer.name,
    email: developer.email,
  }));
}

export async function listDevelopers() {
  const database = await getDb();
  const developers = await database.collection<UserDocument>("users")
    .find({ role: { $in: ["developer", "admin"] }, access: { $ne: "pending" } })
    .sort({ name: 1 })
    .toArray();
  return developers.map((developer) => ({
    id: developer._id.toHexString(),
    name: developer.name,
    email: developer.email,
    role: developer.role,
    active: developer.active,
    createdAt: developer.createdAt,
  }));
}

/** Accounts that signed in with GitHub and asked for access; an administrator approves or declines them. */
export async function listAccessRequests() {
  const database = await getDb();
  const rows = await database.collection<UserDocument>("users").find({ role: "developer", access: "pending" }).sort({ requestedAt: 1 }).toArray();
  return rows.map((row) => ({ id: row._id.toHexString(), name: row.name, email: row.email, requestedAt: row.requestedAt ?? row.createdAt }));
}

export async function countAccessRequests() {
  const database = await getDb();
  return database.collection<UserDocument>("users").countDocuments({ role: "developer", access: "pending" });
}

/** Total and open (open, in progress, still a bug) issues per module under the current filters, for the cards above the list. */
export async function moduleStats(input: FilterInput) {
  const database = await getDb();
  const scope = issueFilter(input);
  const rows = await database.collection<IssueDocument>("issues").aggregate<{ _id: string; total: number; open: number }>([
    { $match: scope },
    { $group: { _id: "$module", total: { $sum: 1 }, open: { $sum: { $cond: [{ $in: ["$status", ["open", "in-progress", "still-bug"]] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  return rows.map((row) => ({ module: row._id, total: row.total, open: row.open }));
}
