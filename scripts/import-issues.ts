import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb, closeDb } from "@/lib/db/mongo";
import { importCatalogue, type SourceIssue } from "@/lib/issues/import";

async function main() {
  const items = JSON.parse(await readFile(path.join(process.cwd(), "data", "items.json"), "utf8")) as SourceIssue[];
  const counts = await importCatalogue(await getDb(), items);
  console.log(
    `${items.length} source issues processed: ${counts.added} new, ${counts.applied} status moved from the code check, ` +
      `${counts.kept} kept a person's status, ${counts.adopted} adopted (first sync). Comments, assignments and people's statuses preserved.`,
  );
}

main().finally(closeDb);
