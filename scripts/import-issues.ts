import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb, closeDb } from "@/lib/db";
import type { IssueDocument } from "@/lib/db/types";

type SourceIssue = {
  id: string;
  title: string;
  module: string;
  side: string;
  severity: string;
  status: IssueDocument["status"];
};

async function main() {
  const sourcePath = path.join(process.cwd(), "data", "items.json");
  const items = JSON.parse(await readFile(sourcePath, "utf8")) as SourceIssue[];
  const database = await getDb();
  const collection = database.collection<IssueDocument>("issues");
  let imported = 0;

  for (let offset = 0; offset < items.length; offset += 100) {
    const batch = items.slice(offset, offset + 100);
    const result = await collection.bulkWrite(
      batch.map((item) => ({
        updateOne: {
          filter: { externalId: item.id },
          update: {
            $set: {
              title: item.title,
              module: item.module,
              side: item.side,
              severity: item.severity,
              details: item as unknown as Record<string, unknown>,
            },
            $setOnInsert: {
              status: item.status,
              assigneeId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    imported += result.upsertedCount;
  }

  console.log(`${items.length} source issues processed; ${imported} newly imported; existing work preserved`);
}

main().finally(closeDb);
