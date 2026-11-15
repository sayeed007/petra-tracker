import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import type { UserDocument } from "@/lib/db/types";

export async function currentUser() {
  const session = await auth();
  if (!session?.user.id || !ObjectId.isValid(session.user.id)) return null;
  const database = await getDb();
  const user = await database.collection<UserDocument>("users").findOne({
    _id: new ObjectId(session.user.id),
    active: true,
  });
  if (!user) return null;
  return {
    id: user._id.toHexString(),
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function requireUser(locale: string) {
  const user = await currentUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}

export async function requireAdmin(locale: string) {
  const user = await requireUser(locale);
  if (user.role !== "admin") redirect(`/${locale}/issues?denied=1`);
  return user;
}
