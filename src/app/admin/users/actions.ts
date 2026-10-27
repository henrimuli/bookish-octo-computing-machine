"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { addAdmin, AdminUserError, removeAdmin } from "@/lib/admin/users";

type Result = { ok: true } | { ok: false; error: string };

async function staff() {
  const user = await getCurrentUser();
  return user && (await isStaff(user)) ? user : null;
}

export async function addAdminAction(email: string, role: string): Promise<Result> {
  const user = await staff();
  if (!user) return { ok: false, error: "Not allowed." };
  try {
    await addAdmin({ email, role }, user.id);
    refresh();
    return { ok: true };
  } catch (err) {
    if (err instanceof AdminUserError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function removeAdminAction(id: string): Promise<Result> {
  const user = await staff();
  if (!user || !z.string().uuid().safeParse(id).success) return { ok: false, error: "Not allowed." };
  try {
    await removeAdmin(id, user);
    refresh();
    return { ok: true };
  } catch (err) {
    if (err instanceof AdminUserError) return { ok: false, error: err.message };
    throw err;
  }
}
