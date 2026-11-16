"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ObjectId, type Filter } from "mongodb";
import { redirect } from "next/navigation";
import { canManageIssue, decisionSchema, parseBulkAssign, parseIssueUpdate, developerSchema, listQuery } from "@/lib/issues/domain";
import { getDb, getMongoClient } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth/user";
import { importCatalogue as runCatalogueImport, type SourceIssue } from "@/lib/issues/import";
import type { CommentDocument, IssueDocument, UserDocument } from "@/lib/db/types";

function safeLocale(locale: string) {
  return locale === "bn" ? "bn" : "en";
}

type UpdateResult = "invalid" | "reason" | "denied" | "missing" | "conflict" | "saved" | "requested";

/**
 * A comment, with or without a status.
 *  - Administrator: the status chosen here is final (any waiting developer request is closed as superseded).
 *  - Developer (assigned issues only): a status here is only a REQUEST. The issue keeps its status until an
 *    administrator approves it (decideRequest); a comment without a status needs no approval.
 */
async function applyIssueUpdate(
  user: { id: string; role: "admin" | "developer" },
  externalId: string,
  formData: FormData,
): Promise<UpdateResult> {
  const update = parseIssueUpdate({
    status: formData.get("status"),
    comment: formData.get("comment"),
  });
  if (!update.success) return update.error.issues.some((issue) => issue.message === "wontfix-reason") ? "reason" : "invalid";
  const parsed = update.data;
  const database = await getDb();
  const client = await getMongoClient();
  const issues = database.collection<IssueDocument>("issues");
  const comments = database.collection<CommentDocument>("comments");
  const actorId = new ObjectId(user.id);
  return client.withSession(async (session) =>
    session.withTransaction(async (): Promise<UpdateResult> => {
      const issue = await issues.findOne({ externalId }, { session });
      if (!issue) return "missing";
      if (!canManageIssue(user, issue.assigneeId?.toHexString() ?? null)) return "denied";

      const now = new Date();
      const wantsChange = parsed.status !== undefined && parsed.status !== issue.status;
      const filter: Filter<IssueDocument> = { _id: issue._id, status: issue.status };
      if (user.role === "developer") filter.assigneeId = actorId;

      // An earlier request that is still waiting is closed whenever the situation moves on.
      const closePending = async (note: string) => {
        if (!issue.pendingRequest) return;
        await comments.updateOne(
          { _id: issue.pendingRequest.commentId },
          { $set: { decision: "superseded", decidedBy: actorId, decidedAt: now, decisionNote: note } },
          { session },
        );
      };

      if (user.role === "admin" || !wantsChange) {
        const changed = user.role === "admin" && wantsChange;
        const result = await issues.updateOne(filter, {
          $set: { ...(changed ? { status: parsed.status, pendingRequest: null } : {}), updatedAt: now },
        }, { session });
        if (!result.matchedCount) return "conflict";
        if (changed) await closePending("Superseded by the administrator's own status change.");
        await comments.insertOne({
          issueId: issue._id,
          authorId: actorId,
          kind: "user",
          body: parsed.comment,
          statusFrom: changed ? issue.status : null,
          statusTo: changed ? parsed.status! : null,
          createdAt: now,
        } as CommentDocument, { session });
        return "saved";
      }

      // A developer asks for a status: record the request, leave the status alone.
      await closePending("Replaced by a newer request.");
      const request = await comments.insertOne({
        issueId: issue._id,
        authorId: actorId,
        kind: "request",
        body: parsed.comment,
        requestedStatus: parsed.status!,
        decision: "pending",
        statusFrom: issue.status,
        statusTo: null,
        createdAt: now,
      } as CommentDocument, { session });
      const result = await issues.updateOne(filter, {
        $set: { pendingRequest: { commentId: request.insertedId, status: parsed.status!, by: actorId, at: now }, updatedAt: now },
      }, { session });
      if (!result.matchedCount) return "conflict";
      return "requested";
    }),
  );
}

export async function updateIssue(locale: string, externalId: string, formData: FormData) {
  const language = safeLocale(locale);
  const user = await requireUser(language);
  const result = await applyIssueUpdate(user, externalId, formData);
  const here = `/${language}/issues/${encodeURIComponent(externalId)}`;
  if (result === "invalid" || result === "reason") redirect(`${here}?error=${result}`);
  if (result === "denied") redirect(`/${language}/issues?denied=1`);
  if (result === "missing") redirect(`/${language}/issues?missing=1`);
  if (result === "conflict") redirect(`${here}?conflict=1`);
  redirect(`${here}?${result === "requested" ? "requested" : "updated"}=1`);
}

/** The same update, answered in place for the list's drawer (no redirect). */
export async function updateIssueInline(locale: string, externalId: string, formData: FormData): Promise<{ result: UpdateResult }> {
  const user = await requireUser(safeLocale(locale));
  return { result: await applyIssueUpdate(user, externalId, formData) };
}

/** The administrator's decision on a developer's status request: approve (the status changes) or reject (with a reason). */
export async function decideRequest(locale: string, externalId: string, formData: FormData) {
  const language = safeLocale(locale);
  const admin = await requireAdmin(language);
  const parsed = decisionSchema.safeParse({ decision: formData.get("decision"), note: formData.get("note") ?? "" });
  if (!parsed.success) redirect(`/${language}/issues/${encodeURIComponent(externalId)}?error=${parsed.error.issues.some((issue) => issue.message === "reject-reason") ? "rejectReason" : "invalid"}`);
  const { decision, note } = parsed.data;
  const database = await getDb();
  const client = await getMongoClient();
  const issues = database.collection<IssueDocument>("issues");
  const comments = database.collection<CommentDocument>("comments");
  const adminId = new ObjectId(admin.id);
  const outcome = await client.withSession(async (session) =>
    session.withTransaction(async () => {
      const issue = await issues.findOne({ externalId }, { session });
      if (!issue) return "missing" as const;
      const pending = issue.pendingRequest;
      if (!pending) return "nopending" as const;

      const now = new Date();
      const approved = decision === "approve";
      const result = await issues.updateOne(
        { _id: issue._id, status: issue.status, "pendingRequest.commentId": pending.commentId },
        { $set: { ...(approved ? { status: pending.status } : {}), pendingRequest: null, updatedAt: now } },
        { session },
      );
      if (!result.matchedCount) return "conflict" as const;
      await comments.updateOne(
        { _id: pending.commentId },
        { $set: { decision: approved ? "approved" : "rejected", decidedBy: adminId, decidedAt: now, decisionNote: note || null } },
        { session },
      );
      await comments.insertOne({
        issueId: issue._id,
        authorId: adminId,
        kind: "system",
        body: approved
          ? `${admin.name} approved the request: "${issue.status}" → "${pending.status}".${note ? ` ${note}` : ""}`
          : `${admin.name} rejected the request for "${pending.status}": ${note}`,
        statusFrom: approved ? issue.status : null,
        statusTo: approved ? pending.status : null,
        createdAt: now,
      } as CommentDocument, { session });
      return "done" as const;
    }),
  );

  if (outcome === "missing") redirect(`/${language}/issues?missing=1`);
  if (outcome === "nopending" || outcome === "conflict") redirect(`/${language}/issues/${encodeURIComponent(externalId)}?conflict=1`);
  redirect(`/${language}/issues/${encodeURIComponent(externalId)}?decided=${decision === "approve" ? "approved" : "rejected"}`);
}

/** The active developer behind an assignee id from a form, null for "unassigned", undefined for an invalid choice. */
async function resolveAssignee(rawId: string) {
  if (!rawId) return null;
  if (!ObjectId.isValid(rawId)) return undefined;
  const database = await getDb();
  const developer = await database.collection<UserDocument>("users").findOne({
    _id: new ObjectId(rawId),
    role: "developer",
    active: true,
  });
  return developer ?? undefined;
}

export async function assignIssue(locale: string, externalId: string, formData: FormData) {
  const language = safeLocale(locale);
  const admin = await requireAdmin(language);
  const developer = await resolveAssignee(String(formData.get("assigneeId") ?? ""));
  if (developer === undefined) redirect(`/${language}/issues/${encodeURIComponent(externalId)}?assignment=invalid`);

  const database = await getDb();
  const issues = database.collection<IssueDocument>("issues");
  const issue = await issues.findOne({ externalId }, { projection: { _id: 1, assigneeId: 1 } });
  if (!issue) redirect(`/${language}/issues?missing=1`);
  const now = new Date();
  await issues.updateOne({ _id: issue._id }, { $set: { assigneeId: developer?._id ?? null, updatedAt: now } });
  await database.collection<CommentDocument>("comments").insertOne({
    issueId: issue._id,
    authorId: new ObjectId(admin.id),
    kind: "system",
    body: developer ? `${admin.name} assigned this issue to ${developer.name}.` : `${admin.name} removed the assignee.`,
    statusFrom: null,
    statusTo: null,
    createdAt: now,
  } as CommentDocument);
  redirect(`/${language}/issues/${encodeURIComponent(externalId)}?assigned=1`);
}

/** Assigns the ticked issues of the list (at most MAX_BULK_ASSIGN) to one developer, or clears their assignee. */
export async function assignIssues(locale: string, formData: FormData) {
  const language = safeLocale(locale);
  const admin = await requireAdmin(language);
  // back to the same filters, module and page the administrator was on
  const back = listQuery(String(formData.get("back") ?? ""));
  const list = (message: string) => `/${language}/issues?${back ? `${back}&` : ""}${message}`;
  const parsed = parseBulkAssign({ ids: formData.getAll("ids"), assigneeId: formData.get("assigneeId") });
  if (!parsed) redirect(list("bulk=none"));
  const developer = await resolveAssignee(parsed.assigneeId);
  if (developer === undefined) redirect(list("bulk=invalid"));

  const database = await getDb();
  const issues = database.collection<IssueDocument>("issues");
  const rows = await issues.find({ externalId: { $in: parsed.ids } }).project<Pick<IssueDocument, "_id">>({ _id: 1 }).toArray();
  const now = new Date();
  if (rows.length) {
    await issues.updateMany({ _id: { $in: rows.map((row) => row._id) } }, { $set: { assigneeId: developer?._id ?? null, updatedAt: now } });
    await database.collection<CommentDocument>("comments").insertMany(rows.map((row) => ({
      issueId: row._id,
      authorId: new ObjectId(admin.id),
      kind: "system",
      body: developer ? `${admin.name} assigned this issue to ${developer.name}.` : `${admin.name} removed the assignee.`,
      statusFrom: null,
      statusTo: null,
      createdAt: now,
    }) as CommentDocument));
  }
  redirect(list(`bulk=done&count=${rows.length}`));
}

export async function createDeveloper(locale: string, formData: FormData) {
  const language = safeLocale(locale);
  await requireAdmin(language);
  const parsed = developerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) redirect(`/${language}/developers?error=invalid`);

  const database = await getDb();
  try {
    await database.collection<UserDocument>("users").insertOne({
      email: parsed.data.email,
      name: parsed.data.name,
      role: "developer",
      active: true,
      createdAt: new Date(),
    } as UserDocument);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      // Adding someone who already asked for access (or was declined) is an approval.
      const approved = await database.collection<UserDocument>("users").updateOne(
        { email: parsed.data.email, role: "developer", access: { $in: ["pending", "declined"] } },
        { $set: { name: parsed.data.name, active: true, access: "approved" } },
      );
      if (approved.matchedCount) redirect(`/${language}/developers?created=1`);
      redirect(`/${language}/developers?error=exists`);
    }
    throw error;
  }
  redirect(`/${language}/developers?created=1`);
}

export async function setDeveloperActive(locale: string, developerId: string, formData: FormData) {
  const language = safeLocale(locale);
  await requireAdmin(language);
  if (!ObjectId.isValid(developerId)) redirect(`/${language}/developers?error=invalid`);
  const active = formData.get("active") === "true";
  const database = await getDb();
  await database.collection<UserDocument>("users").updateOne(
    { _id: new ObjectId(developerId), role: "developer" },
    { $set: { active } },
  );
  redirect(`/${language}/developers?updated=1`);
}

/** Reads the catalogue bundled with this deployment (data/items.json) into the database; safe to repeat. */
export async function importCatalogue(locale: string) {
  const language = safeLocale(locale);
  await requireAdmin(language);
  let counts;
  try {
    const items = JSON.parse(await readFile(path.join(process.cwd(), "data", "items.json"), "utf8")) as SourceIssue[];
    counts = await runCatalogueImport(await getDb(), items);
  } catch {
    redirect(`/${language}/issues?import=failed`);
  }
  redirect(`/${language}/issues?import=done&added=${counts.added}&moved=${counts.applied}&kept=${counts.kept}`);
}

/** An administrator's answer to an access request: the developer can then sign in (approve) or not (decline). */
export async function decideAccess(locale: string, developerId: string, formData: FormData) {
  const language = safeLocale(locale);
  await requireAdmin(language);
  if (!ObjectId.isValid(developerId)) redirect(`/${language}/developers?error=invalid`);
  const approve = formData.get("decision") === "approve";
  const database = await getDb();
  const result = await database.collection<UserDocument>("users").updateOne(
    { _id: new ObjectId(developerId), role: "developer", access: "pending" },
    { $set: approve ? { active: true, access: "approved" } : { active: false, access: "declined" } },
  );
  if (!result.matchedCount) redirect(`/${language}/developers?error=invalid`);
  redirect(`/${language}/developers?access=${approve ? "approved" : "declined"}`);
}
