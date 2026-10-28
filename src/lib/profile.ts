import { z } from "zod";

/** A maker's public profile, as edited at /dashboard/profile. Pure, shared by the form, the action and tests. */

export const BIO_MAX = 160;

const handlePatterns = {
  x: { hosts: ["x.com", "twitter.com"], handle: /^[A-Za-z0-9_]{1,15}$/, base: "https://x.com/" },
  github: {
    hosts: ["github.com"],
    handle: /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/,
    base: "https://github.com/",
  },
} as const;

export type SocialKind = keyof typeof handlePatterns;

/**
 * Accepts "@name", "name" or a profile URL (x.com, twitter.com, github.com,
 * with or without https:// and www.) and returns the canonical profile URL.
 * Blank input clears the link.
 */
export function normalizeSocial(
  kind: SocialKind,
  raw: string,
): { ok: true; url: string | null } | { ok: false; error: string } {
  const p = handlePatterns[kind];
  const label = kind === "x" ? "X" : "GitHub";
  const s = raw.trim();
  if (!s) return { ok: true, url: null };

  let handle = s.replace(/^@/, "");
  if (!p.handle.test(handle)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    } catch {
      return { ok: false, error: `Enter your ${label} username or profile link.` };
    }
    const host = url.hostname.toLowerCase().replace(/^(www|mobile)\./, "");
    if (!(p.hosts as readonly string[]).includes(host)) {
      return { ok: false, error: `That isn't a ${label} link. Use your ${label} username or profile link.` };
    }
    handle = url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "") ?? "";
  }
  if (!p.handle.test(handle)) return { ok: false, error: `That ${label} username doesn't look right.` };
  return { ok: true, url: p.base + handle };
}

/** The username part of a stored profile URL, for display ("@name"). */
export function socialHandle(url: string): string {
  return url.replace(/\/+$/, "").split("/").at(-1) ?? url;
}

export const ProfileInput = z.object({
  name: z.string().trim().min(1, "Add your name.").max(60, "Keep your name under 60 characters."),
  image: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => !v || /^https:\/\/\S+$/.test(v), "The picture needs an https:// link.")
    .transform((v) => v || null),
  bio: z
    .string()
    .trim()
    .max(BIO_MAX, `Keep your bio under ${BIO_MAX} characters.`)
    .transform((v) => v.replace(/\s*\n\s*/g, " ") || null),
  x: z.string(),
  github: z.string(),
});

export type ProfileValues = { name: string; image: string; bio: string; x: string; github: string };

export type Profile = {
  name: string;
  image: string | null;
  bio: string | null;
  xUrl: string | null;
  githubUrl: string | null;
};

/** Validates the form; returns the row to store or the first error. */
export function parseProfile(values: ProfileValues): { ok: true; profile: Profile } | { ok: false; error: string } {
  const parsed = ProfileInput.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const x = normalizeSocial("x", parsed.data.x);
  if (!x.ok) return x;
  const github = normalizeSocial("github", parsed.data.github);
  if (!github.ok) return github;
  const { name, image, bio } = parsed.data;
  return { ok: true, profile: { name, image, bio, xUrl: x.url, githubUrl: github.url } };
}
