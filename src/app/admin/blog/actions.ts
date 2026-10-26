"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { renderMarkdown } from "@/lib/blog/markdown";
import { deletePost, PostError, savePost, setPublished, type PostInput } from "@/lib/blog/service";

type Result = { ok: true; id: string; slug: string } | { ok: false; error: string };

async function staffOnly() {
  const user = await getCurrentUser();
  return user && isStaff(user) ? user : null;
}

const uuid = z.string().uuid();

export async function savePostAction(input: PostInput, id: string | null): Promise<Result> {
  const user = await staffOnly();
  if (!user) return { ok: false, error: "Not allowed." };
  if (id && !uuid.safeParse(id).success) return { ok: false, error: "Post not found." };
  try {
    const post = await savePost(user.id, input, id ?? undefined);
    refresh();
    return { ok: true, id: post.id, slug: post.slug };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? "Check the form." };
    if (err instanceof PostError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setPublishedAction(id: string, published: boolean): Promise<Result> {
  if (!(await staffOnly())) return { ok: false, error: "Not allowed." };
  if (!uuid.safeParse(id).success) return { ok: false, error: "Post not found." };
  try {
    const post = await setPublished(id, published);
    refresh();
    return { ok: true, id: post.id, slug: post.slug };
  } catch (err) {
    if (err instanceof PostError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function deletePostAction(id: string) {
  if (!(await staffOnly()) || !uuid.safeParse(id).success) return;
  await deletePost(id);
  redirect("/admin/blog");
}

export async function previewAction(body: string): Promise<string> {
  if (!(await staffOnly())) return "";
  return renderMarkdown(body.slice(0, 100_000));
}
