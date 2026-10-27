"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  addLinkInput,
  addManualLink,
  LinkError,
  linkHistory,
  recheckLink,
  removeLink,
  type TrackedLink,
} from "@/lib/links/service";
import { setLaunchWall } from "@/lib/links/wall";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
const id = z.string().uuid();

async function guard<T>(fn: (userId: string) => Promise<T>): Promise<Result<{ data: T }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  try {
    return { ok: true, data: await fn(user.id) };
  } catch (err) {
    if (err instanceof LinkError) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? "Check the details." };
    throw err;
  }
}

export async function addLinkAction(input: z.input<typeof addLinkInput>): Promise<Result<{ data: TrackedLink }>> {
  const res = await guard((userId) => addManualLink(userId, input));
  if (res.ok) revalidatePath("/dashboard/links");
  return res;
}

export async function recheckLinkAction(linkId: string): Promise<Result<{ data: TrackedLink }>> {
  if (!id.safeParse(linkId).success) return { ok: false, error: "Not found." };
  return guard((userId) => recheckLink(userId, linkId));
}

export async function removeLinkAction(linkId: string): Promise<Result<{ data: null }>> {
  if (!id.safeParse(linkId).success) return { ok: false, error: "Not found." };
  const res = await guard(async (userId) => {
    await removeLink(userId, linkId);
    return null;
  });
  if (res.ok) revalidatePath("/dashboard/links");
  return res;
}

export async function linkHistoryAction(linkId: string) {
  if (!id.safeParse(linkId).success) return { ok: false as const, error: "Not found." };
  return guard((userId) => linkHistory(userId, linkId));
}

export async function setLaunchWallAction(on: boolean) {
  const res = await guard((userId) => setLaunchWall(userId, on === true));
  revalidatePath("/dashboard/links");
  revalidatePath("/launch-wall");
  return res;
}
