"use server";

import { ObjectId, type Filter } from "mongodb";
import { redirect } from "next/navigation";
import { canManageIssue, parseIssueUpdate, developerSchema } from "@/lib/issues/domain";
import { getDb, getMongoClient } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth/user";
import type { CommentDocument, IssueDocument, UserDocument } from "@/lib/db/types";

function safeLocale(locale: string) {
  return locale === "bn" ? "bn" : "en";
}

export async function updateIssue(locale: string, externalId: string, formData: FormData) {
  const language = safeLocale(locale);
  const user = await requireUser(language);
  const update = parseIssueUpdate({
    status: formData.get("status"),
    comment: formData.get("comment"),
  });
  if (!update.success) redirect(`/${language}/issues/${encodeURIComponent(externalId)}?error=invalid`);
  const parsed = update.data;
  const database = await getDb();
  const client = await getMongoClient();
  const issues = database.collection<IssueDocument>("issues");
  const comments = database.collection<CommentDocument>("comments");
  const outcome = await client.withSession(async (session) =>
    session.withTransaction(async () => {
      const issue = await issues.findOne({ externalId }, { session });
      if (!issue) return "missing" as const;
      if (!canManageIssue(user, issue.assigneeId?.toHexString() ?? null)) return "denied" as const;

      const changed = parsed.status !== undefined && parsed.status !== issue.status;
      const filter: Filter<IssueDocument> = { _id: issue._id, status: issue.status };
      if (user.role === "developer") filter.assigneeId = new ObjectId(user.id);
      const result = await issues.updateOne(filter, {
        $set: { ...(changed ? { status: parsed.status } : {}), updatedAt: new Date() },
      }, { session });
      if (!result.matchedCount) return "conflict" as const;

      await comments.insertOne({
        issueId: issue._id,
        authorId: new ObjectId(user.id),
        body: parsed.comment,
        statusFrom: changed ? issue.status : null,
        statusTo: changed ? parsed.status! : null,
        createdAt: new Date(),
      } as CommentDocument, { session });
      return "saved" as const;
    }),
  );

  if (outcome === "denied") redirect(`/${language}/issues?denied=1`);
  if (outcome === "missing") redirect(`/${language}/issues?missing=1`);
  if (outcome === "conflict") redirect(`/${language}/issues/${encodeURIComponent(externalId)}?conflict=1`);
  redirect(`/${language}/issues/${encodeURIComponent(externalId)}?updated=1`);
}

export async function assignIssue(locale: string, externalId: string, formData: FormData) {
  const language = safeLocale(locale);
  await requireAdmin(language);
  const rawId = String(formData.get("assigneeId") ?? "");
  let assigneeId: ObjectId | null = null;
  if (rawId) {
    if (!ObjectId.isValid(rawId)) redirect(`/${language}/issues/${encodeURIComponent(externalId)}?assignment=invalid`);
    assigneeId = new ObjectId(rawId);
    const database = await getDb();
    const developer = await database.collection<UserDocument>("users").findOne({
      _id: assigneeId,
      role: "developer",
      active: true,
    });
    if (!developer) redirect(`/${language}/issues/${encodeURIComponent(externalId)}?assignment=invalid`);
  }

  const database = await getDb();
  const result = await database.collection<IssueDocument>("issues").updateOne(
    { externalId },
    { $set: { assigneeId, updatedAt: new Date() } },
  );
  if (!result.matchedCount) redirect(`/${language}/issues?missing=1`);
  redirect(`/${language}/issues/${encodeURIComponent(externalId)}?assigned=1`);
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
