import { ObjectId, type Filter } from "mongodb";
import { ISSUE_STATUSES, type IssueStatus } from "./domain";
import { getDb } from "@/lib/db";
import type { CommentDocument, IssueDocument, UserDocument } from "@/lib/db/types";

const PAGE_SIZE = 40;
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
  updatedAt: Date;
};

export async function listIssues(input: {
  user: { id: string; role: "admin" | "developer" };
  page: number;
  status?: string;
  module?: string;
  q?: string;
}) {
  const database = await getDb();
  const collection = database.collection<IssueDocument>("issues");
  const filter: Filter<IssueDocument> = input.user.role === "admin"
    ? {}
    : { assigneeId: new ObjectId(input.user.id) };
  if (input.status && ISSUE_STATUSES.includes(input.status as IssueStatus)) {
    filter.status = input.status as IssueStatus;
  }
  if (input.module) filter.module = input.module;
  const query = input.q?.trim().slice(0, 100);
  if (query) {
    const safe = new RegExp(regexEscape(query), "i");
    filter.$or = [{ externalId: safe }, { title: safe }];
  }

  const total = await collection.countDocuments(filter);
  const openFilter = { ...filter };
  delete openFilter.status;
  const open = await collection.countDocuments({
    ...openFilter,
    status: { $in: ["open", "in-progress", "still-bug"] },
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.max(1, Math.min(input.page, pages));
  const rows = await collection.find(filter)
    .sort({ updatedAt: -1, _id: 1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .toArray();
  const assigneeIds = rows.flatMap((issue) => issue.assigneeId ? [issue.assigneeId] : []);
  const developers = assigneeIds.length
    ? await database.collection<UserDocument>("users").find({ _id: { $in: assigneeIds } }).project({ name: 1 }).toArray()
    : [];
  const names = new Map(developers.map((developer) => [developer._id.toHexString(), developer.name]));
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
      updatedAt: issue.updatedAt,
    })),
    total,
    open,
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
    comments: comments.map((comment) => ({
      body: comment.body,
      author: comment.authorId ? names.get(comment.authorId.toHexString()) ?? "Former developer" : "Former developer",
      createdAt: comment.createdAt,
      statusFrom: comment.statusFrom,
      statusTo: comment.statusTo,
    })),
  };
}

export async function listActiveDevelopers() {
  const database = await getDb();
  const developers = await database.collection<UserDocument>("users")
    .find({ role: "developer", active: true })
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
    .find({ role: "developer" })
    .sort({ name: 1 })
    .toArray();
  return developers.map((developer) => ({
    id: developer._id.toHexString(),
    name: developer.name,
    email: developer.email,
    active: developer.active,
    createdAt: developer.createdAt,
  }));
}
