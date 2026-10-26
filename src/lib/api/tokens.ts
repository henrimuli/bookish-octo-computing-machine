import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db, schema } from "@/db";

const { apiTokens } = schema;
export const MAX_TOKENS = 10;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a token and returns it once; only its hash is stored. */
export async function createToken(userId: string, name: string): Promise<{ id: string; token: string }> {
  const active = await listTokens(userId);
  if (active.length >= MAX_TOKENS) throw new Error(`You can have up to ${MAX_TOKENS} tokens. Revoke one first.`);
  const token = `dy_${randomBytes(24).toString("base64url")}`;
  const [row] = await db()
    .insert(apiTokens)
    .values({
      userId,
      name: name.trim().slice(0, 60) || "API token",
      tokenHash: hash(token),
      prefix: token.slice(0, 10),
    })
    .returning({ id: apiTokens.id });
  return { id: row.id, token };
}

export async function listTokens(userId: string) {
  return db()
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.prefix,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
    })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.createdAt));
}

export async function revokeToken(userId: string, id: string) {
  await db()
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
}

export type ApiUser = { id: string; email: string };

/** Resolves `Authorization: Bearer dy_…` to its user, or null. */
export async function authenticate(request: Request): Promise<ApiUser | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(dy_[A-Za-z0-9_-]{20,64})$/.exec(header.trim())?.[1];
  if (!token) return null;
  const [row] = await db()
    .select({ id: apiTokens.id, userId: apiTokens.userId, email: schema.user.email, lastUsedAt: apiTokens.lastUsedAt })
    .from(apiTokens)
    .innerJoin(schema.user, eq(schema.user.id, apiTokens.userId))
    .where(and(eq(apiTokens.tokenHash, hash(token)), isNull(apiTokens.revokedAt)));
  if (!row) return null;
  // Touch at most once a minute.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db().update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
  }
  return { id: row.userId, email: row.email };
}
