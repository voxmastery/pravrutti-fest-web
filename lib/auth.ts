import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { consumeEmailOtp } from "@/lib/email-otp-service";

/**
 * Google sign-in is optional infrastructure: until the OAuth credentials are
 * in the environment the site keeps working, and the ticket page falls back to
 * email lookup. Once they're set, sign-in becomes the only way to view tickets,
 * because a verified Google email is proof the person owns that inbox.
 */
export const googleAuthEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  providers: [
    ...(googleAuthEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
              params: { prompt: "select_account", access_type: "online", scope: "openid email profile" },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      id: "email-otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const result = await consumeEmailOtp(credentials?.email, credentials?.code);
        if (!result.ok) throw new Error(result.error);
        return { id: result.email, email: result.email, name: null };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/ticket", error: "/ticket" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "email-otp") return true;
      // Only trust Google-verified inboxes — the email is the identity key
      // every application is stored against.
      return (profile as { email_verified?: boolean } | undefined)?.email_verified !== false;
    },
    async jwt({ token, profile, user }) {
      const email = profile?.email ?? user?.email;
      if (email) token.email = email.toLowerCase();
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) session.user.email = String(token.email).toLowerCase();
      return session;
    },
  },
};
