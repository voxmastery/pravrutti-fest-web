import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * Google sign-in is optional infrastructure: until the OAuth credentials are
 * in the environment the site keeps working, and the ticket page falls back to
 * email lookup. Once they're set, sign-in becomes the only way to view tickets,
 * because a verified Google email is proof the person owns that inbox.
 */
export const googleAuthEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  providers: googleAuthEnabled
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          authorization: {
            params: { prompt: "select_account", access_type: "online", scope: "openid email profile" },
          },
        }),
      ]
    : [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/ticket", error: "/ticket" },
  callbacks: {
    async signIn({ profile }) {
      // Only trust Google-verified inboxes — the email is the identity key
      // every application is stored against.
      return (profile as any)?.email_verified !== false;
    },
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email.toLowerCase();
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) session.user.email = String(token.email).toLowerCase();
      return session;
    },
  },
};
