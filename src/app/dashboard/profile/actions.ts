"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db, schema } from "@/db";
import { auth, getCurrentUser } from "@/lib/auth";
import { parseProfile, type ProfileValues } from "@/lib/profile";
import { createUploadUrl, MAX_UPLOAD_BYTES } from "@/lib/storage";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function saveProfileAction(values: ProfileValues): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const parsed = parseProfile(values);
  if (!parsed.ok) return parsed;
  const { name, image, bio, xUrl, githubUrl } = parsed.profile;
  await db().update(schema.user).set({ bio, xUrl, githubUrl }).where(eq(schema.user.id, user.id));
  // Through Better Auth so the cached session (sidebar name and avatar) updates too.
  await auth().api.updateUser({ headers: await headers(), body: { name, image } });
  revalidatePath("/dashboard", "layout");
  if (user.handle) revalidatePath(`/builders/${user.handle}`);
  return { ok: true, data: undefined };
}

export async function avatarUploadAction(
  contentType: string,
  size: number,
): Promise<Result<{ uploadUrl: string; publicUrl: string }>> {
  if (!(await getCurrentUser())) return { ok: false, error: "Sign in first." };
  if (size > MAX_UPLOAD_BYTES) return { ok: false, error: "Pictures must be under 5 MB." };
  try {
    const { uploadUrl, publicUrl } = await createUploadUrl({ folder: "avatars", contentType, contentLength: size });
    return { ok: true, data: { uploadUrl, publicUrl } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed" };
  }
}
