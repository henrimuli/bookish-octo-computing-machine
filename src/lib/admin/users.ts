import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { env } from "@/env";
import { normalizeEmail, type StaffRole } from "@/lib/auth";

export class AdminUserError extends Error {}

export const ASSIGNABLE_ROLES = ["admin", "ops"] as const;

/** Everyone with admin access, with their account if they've signed up. */
export async function listAdmins() {
  const { adminUsers, user } = schema;
  const owner = env().ADMIN_EMAIL ? normalizeEmail(env().ADMIN_EMAIL!) : null;
  const rows = await db()
    .select({ a: adminUsers, name: user.name, userId: user.id })
    .from(adminUsers)
    .leftJoin(user, eq(sql`lower(${user.email})`, adminUsers.email))
    .orderBy(asc(adminUsers.createdAt));
  return rows.map((r) => ({
    id: r.a.id,
    email: r.a.email,
    // Only the current ADMIN_EMAIL is the owner; a former one shows as admin.
    role: (r.a.role === "owner" && r.a.email !== owner ? "admin" : r.a.role) as StaffRole,
    name: r.name,
    hasAccount: Boolean(r.userId),
    lastSeenAt: r.a.lastSeenAt,
    createdAt: r.a.createdAt,
  }));
}

const addInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(ASSIGNABLE_ROLES),
});

/** Grants access. They sign in with that email (magic link, Google or GitHub). */
export async function addAdmin(input: { email: string; role: string }, byUserId: string) {
  const parsed = addInput.safeParse(input);
  if (!parsed.success) throw new AdminUserError(parsed.error.issues[0]?.message ?? "Invalid input.");
  const { email, role } = parsed.data;
  const [row] = await db()
    .insert(schema.adminUsers)
    .values({ email, role, addedByUserId: byUserId })
    .onConflictDoNothing()
    .returning({ id: schema.adminUsers.id });
  if (!row) throw new AdminUserError(`${email} already has access.`);
  return row.id;
}

/** Revokes access. The owner (ADMIN_EMAIL) and your own access can't be removed here. */
export async function removeAdmin(id: string, by: { email: string }) {
  const row = await db().query.adminUsers.findFirst({ where: eq(schema.adminUsers.id, id) });
  if (!row) return;
  const owner = env().ADMIN_EMAIL ? normalizeEmail(env().ADMIN_EMAIL!) : null;
  if (row.email === owner) throw new AdminUserError("The owner is set by ADMIN_EMAIL and can't be removed here.");
  if (row.email === normalizeEmail(by.email)) throw new AdminUserError("You can't remove your own access.");
  await db().delete(schema.adminUsers).where(eq(schema.adminUsers.id, id));
}
