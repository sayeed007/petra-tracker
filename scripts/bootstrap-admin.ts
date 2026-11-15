import "dotenv/config";
import { getDb, closeDb } from "@/lib/db/mongo";
import type { UserDocument } from "@/lib/db/types";

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  if (!email || !name) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_NAME first");

  const database = await getDb();
  const users = database.collection<UserDocument>("users");
  const existing = await users.findOne({ email });
  if (existing) {
    if (existing.role !== "admin") throw new Error("That email already belongs to a non-admin user");
    console.log(`Admin already exists: ${email}`);
    return;
  }

  await users.insertOne({
    email,
    name,
    role: "admin",
    active: true,
    createdAt: new Date(),
  } as UserDocument);
  console.log(`Admin added: ${email}`);
}

main().finally(closeDb);
