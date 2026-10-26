"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createToken, revokeToken } from "@/lib/api/tokens";

export async function createTokenAction(
  name: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  try {
    const { token } = await createToken(user.id, name);
    refresh();
    return { ok: true, token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't create the token." };
  }
}

export async function revokeTokenAction(id: string) {
  const user = await getCurrentUser();
  if (!user || !z.string().uuid().safeParse(id).success) return;
  await revokeToken(user.id, id);
  refresh();
}
