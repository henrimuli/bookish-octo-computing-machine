import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";

function socialProviders() {
  const e = env();
  return {
    ...(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } }
      : {}),
    ...(e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET
      ? { github: { clientId: e.GITHUB_CLIENT_ID, clientSecret: e.GITHUB_CLIENT_SECRET } }
      : {}),
  };
}

function createAuth() {
  const e = env();
  return betterAuth({
    appName: "DebutYard",
    baseURL: e.NEXT_PUBLIC_SITE_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "user", input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
    },
    socialProviders: socialProviders(),
    plugins: [
      magicLink({
        expiresIn: 60 * 15,
        sendMagicLink: async ({ email, url }) => {
          await sendEmail({
            to: email,
            subject: "Your DebutYard sign-in link",
            text: `Sign in to DebutYard: ${url}\n\nThis link expires in 15 minutes. If you didn't ask for it, ignore this email.`,
            html: `<p>Sign in to DebutYard:</p><p><a href="${url}">Sign in</a></p><p>This link expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`,
          });
        },
      }),
      // Must stay last: lets server actions set auth cookies.
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;

/** Lazily built so importing this module never requires a database. */
export function auth(): Auth {
  instance ??= createAuth();
  return instance;
}

export type SessionUser = Auth["$Infer"]["Session"]["user"];

/** The signed-in user for the current request, or null. Call inside a Suspense boundary. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export function enabledSocialProviders(): Array<"google" | "github"> {
  return Object.keys(socialProviders()) as Array<"google" | "github">;
}
