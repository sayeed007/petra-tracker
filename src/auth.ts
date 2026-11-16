import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { getDb } from "@/lib/db";
import { accessOutcome, isBootstrapAdmin } from "@/lib/issues/domain";
import type { UserDocument } from "@/lib/db/types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/en/login" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const database = await getDb();
      const users = database.collection<UserDocument>("users");
      const email = user.email.toLowerCase();
      const existing = await users.findOne({ email });
      if (existing?.active) return true;

      // No administrator yet: the configured bootstrap account becomes the first one (never anyone else).
      const adminCount = await users.countDocuments({ role: "admin" });
      if (isBootstrapAdmin({ email, bootstrapEmail: process.env.BOOTSTRAP_ADMIN_EMAIL, adminCount })) {
        await users.updateOne(
          { email },
          { $set: { name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || user.name || email, role: "admin", active: true, access: "approved" }, $setOnInsert: { email, createdAt: new Date() } },
          { upsert: true },
        );
        console.warn(`[tracker] first administrator created: ${email}`);
        return true;
      }

      // Anyone else is not let in. A new account leaves an access request for an administrator to decide;
      // the visitor is sent to a page that says so (no session is created).
      const outcome = accessOutcome(existing);
      if (outcome === "request") {
        const now = new Date();
        await users.updateOne(
          { email },
          { $setOnInsert: { email, name: user.name?.trim().slice(0, 120) || email, role: "developer", active: false, access: "pending", requestedAt: now, createdAt: now } },
          { upsert: true },
        );
        console.warn(`[tracker] access requested by ${email}`);
      } else {
        console.warn(`[tracker] sign-in refused for ${email}: ${outcome}`);
      }
      return `/en/access-requested?state=${outcome === "request" ? "waiting" : outcome}`;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "github" && user?.email) {
        const database = await getDb();
        const member = await database.collection<UserDocument>("users").findOne({
          email: user.email.toLowerCase(),
          active: true,
        });
        if (member) {
          token.sub = member._id.toHexString();
          token.role = member.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role === "admin" || token.role === "developer" ? token.role : null;
      }
      return session;
    },
  },
});
