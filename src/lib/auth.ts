import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db, schema } from "@/db";
import { env } from "@/env";
import { sendEmail } from "@/lib/email";
import { slugify, uniqueSlug } from "@/lib/slug";

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
        handle: { type: "string", required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (data) => {
            const base = slugify(data.name || data.email.split("@")[0] || "", 24);
            const handle = await uniqueSlug(base, async (h) =>
              Boolean(await db().query.user.findFirst({ where: eq(schema.user.handle, h), columns: { id: true } })),
            );
            const isAdmin = e.ADMIN_EMAIL && data.email.toLowerCase() === e.ADMIN_EMAIL.toLowerCase();
            return { data: { ...data, handle, role: isAdmin ? "admin" : "user" } };
          },
        },
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
  // Read the request first: it marks this render as dynamic before anything touches the database.
  const requestHeaders = await headers();
  const session = await auth().api.getSession({ headers: requestHeaders });
  return session?.user ?? null;
}

/** The signed-in user, or a redirect to sign-in. For pages and server actions. */
export async function requireUser(returnTo = "/"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export function isStaff(user: SessionUser | null): boolean {
  return user?.role === "admin" || user?.role === "ops";
}

/** Admin/ops only; everyone else gets a 404 so the admin area isn't advertised. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) notFound();
  return user;
}

export function enabledSocialProviders(): Array<"google" | "github"> {
  return Object.keys(socialProviders()) as Array<"google" | "github">;
}
