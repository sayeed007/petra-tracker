import type { Db } from "mongodb";
import type { CommentDocument, IssueDocument } from "@/lib/db/types";
import { planSourceSync } from "./domain";

export type SourceIssue = {
  id: string;
  title: string;
  module: string;
  side: string;
  severity: string;
  status: IssueDocument["status"];
  status_evidence?: string;
};

export type ImportCounts = { added: number; applied: number; kept: number; adopted: number };

/**
 * Re-runnable import of the catalogue (data/items.json). Source details are refreshed every time; the portal
 * keeps what the people did. A catalogue status that moved since the last import is applied only to issues nobody
 * changed (see planSourceSync), and each such move leaves a system note in the issue's activity.
 */
export async function importCatalogue(database: Db, items: SourceIssue[]): Promise<ImportCounts> {
  const collection = database.collection<IssueDocument>("issues");
  const comments = database.collection<CommentDocument>("comments");
  const counts: ImportCounts = { added: 0, applied: 0, kept: 0, adopted: 0 };

  for (let offset = 0; offset < items.length; offset += 100) {
    const batch = items.slice(offset, offset + 100);
    const existingRows = await collection
      .find({ externalId: { $in: batch.map((item) => item.id) } })
      .project<Pick<IssueDocument, "_id" | "externalId" | "status" | "sourceStatus">>({ externalId: 1, status: 1, sourceStatus: 1 })
      .toArray();
    const existing = new Map(existingRows.map((row) => [row.externalId, row]));
    const notes: CommentDocument[] = [];
    const now = new Date();

    const operations = batch.map((item) => {
      const common = {
        title: item.title,
        module: item.module,
        side: item.side,
        severity: item.severity,
        details: item as unknown as Record<string, unknown>,
      };
      const row = existing.get(item.id);
      if (!row) {
        counts.added += 1;
        return {
          updateOne: {
            filter: { externalId: item.id },
            update: {
              $set: common,
              $setOnInsert: { status: item.status, sourceStatus: item.status, assigneeId: null, createdAt: now, updatedAt: now },
            },
            upsert: true,
          },
        };
      }

      const plan = planSourceSync(row, item.status);
      const set: Record<string, unknown> = { ...common };
      if (plan === "adopt") {
        counts.adopted += 1;
        set.sourceStatus = item.status;
      } else if (plan === "apply" || plan === "keep") {
        set.sourceStatus = item.status;
        set.updatedAt = now;
        if (plan === "apply") set.status = item.status;
        counts[plan === "apply" ? "applied" : "kept"] += 1;
        const evidence = item.status_evidence ? ` Evidence: ${item.status_evidence}`.slice(0, 1200) : "";
        notes.push({
          issueId: row._id,
          authorId: null,
          kind: "system",
          body: plan === "apply"
            ? `The code check moved this issue from "${row.sourceStatus}" to "${item.status}".${evidence}`
            : `The code check now says "${item.status}" (it said "${row.sourceStatus}"); the portal status "${row.status}" was set by a person and was kept.${evidence}`,
          statusFrom: plan === "apply" ? row.status : null,
          statusTo: plan === "apply" ? item.status : null,
          createdAt: now,
        } as CommentDocument);
      }
      return { updateOne: { filter: { externalId: item.id }, update: { $set: set } } };
    });

    await collection.bulkWrite(operations, { ordered: false });
    if (notes.length) await comments.insertMany(notes);
  }
  return counts;
}
