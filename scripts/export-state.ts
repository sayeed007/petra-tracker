import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb, closeDb } from "@/lib/db/mongo";
import type { CommentDocument, IssueDocument, UserDocument } from "@/lib/db/types";

/**
 * Writes what the people did in the portal to data/portal-state.json, so the code check (tools/build.py and the agents
 * that maintain data/) can see which statuses developers changed, who owns what, and the last comment of each issue.
 * Read-only against the database. The file is a snapshot: do not edit it by hand.
 */
async function main() {
  const database = await getDb();
  const [issues, users, comments] = await Promise.all([
    database.collection<IssueDocument>("issues").find({}).toArray(),
    database.collection<UserDocument>("users").find({}).toArray(),
    database.collection<CommentDocument>("comments").find({ kind: { $ne: "system" } }).sort({ createdAt: 1 }).toArray(),
  ]);
  const names = new Map(users.map((user) => [user._id.toHexString(), user.name]));
  const lastComment = new Map<string, CommentDocument>();
  for (const comment of comments) lastComment.set(comment.issueId.toHexString(), comment);

  const changed = issues
    .filter((issue) => issue.sourceStatus != null && issue.status !== issue.sourceStatus || issue.pendingRequest || issue.assigneeId || lastComment.has(issue._id.toHexString()))
    .map((issue) => {
      const last = lastComment.get(issue._id.toHexString());
      return {
        id: issue.externalId,
        status: issue.status,
        sourceStatus: issue.sourceStatus ?? null,
        pendingRequest: issue.pendingRequest ? { status: issue.pendingRequest.status, by: names.get(issue.pendingRequest.by.toHexString()) ?? null, at: issue.pendingRequest.at.toISOString() } : null,
        assignee: issue.assigneeId ? (names.get(issue.assigneeId.toHexString()) ?? null) : null,
        updatedAt: issue.updatedAt.toISOString(),
        lastComment: last
          ? { by: last.authorId ? (names.get(last.authorId.toHexString()) ?? null) : null, at: last.createdAt.toISOString(), text: last.body, statusTo: last.statusTo }
          : null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const target = path.join(process.cwd(), "data", "portal-state.json");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify({ exportedAt: new Date().toISOString(), issues: changed }, null, 1) + "\n", "utf8");
  console.log(`${changed.length} of ${issues.length} issues carry portal work -> ${target}`);
}

main().finally(closeDb);
