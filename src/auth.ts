import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { getDb } from "@/lib/db";
import type { UserDocument } from "@/lib/db/types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/en/login" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const database = await getDb();
      const member = await database.collection<UserDocument>("users").findOne({
        email: user.email.toLowerCase(),
        active: true,
      });
      return Boolean(member);
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
