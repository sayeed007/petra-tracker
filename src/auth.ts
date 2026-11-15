import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { getDb } from "@/lib/db";
import { isBootstrapAdmin } from "@/lib/issues/domain";
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
      const member = await users.findOne({ email, active: true });
      if (member) return true;

      // No administrator yet: the configured bootstrap account becomes the first one (never anyone else).
      const adminCount = await users.countDocuments({ role: "admin" });
      if (!isBootstrapAdmin({ email, bootstrapEmail: process.env.BOOTSTRAP_ADMIN_EMAIL, adminCount })) {
        console.warn(`[tracker] sign-in refused for ${email}: not an active tracker account`);
        return false;
      }
      await users.updateOne(
        { email },
        { $setOnInsert: { email, name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || user.name || email, role: "admin", active: true, createdAt: new Date() } },
        { upsert: true },
      );
      console.warn(`[tracker] first administrator created: ${email}`);
      return true;
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
