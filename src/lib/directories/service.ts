import "server-only";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { slugify } from "@/lib/slug";

const { directories } = schema;
export type Directory = typeof directories.$inferSelect;

export const NICHES = ["general", "devtools", "ai", "indie", "b2b"] as const;
export const NICHE_LABELS: Record<(typeof NICHES)[number], string> = {
  general: "General",
  devtools: "Developer tools",
  ai: "AI tools",
  indie: "Indie & startups",
  b2b: "B2B software",
};
export const PRICINGS = ["free", "freemium", "paid"] as const;

export const directoryFilters = z.object({
  niche: z.enum(NICHES).optional(),
  pricing: z.enum(PRICINGS).optional(),
  /** Hide directories that require a badge. */
  noBadge: z.boolean().optional(),
  dofollow: z.boolean().optional(),
  q: z.string().trim().max(60).optional(),
  sort: z.enum(["dr", "name", "acceptance"]).default("dr"),
});
export type DirectoryFilters = z.input<typeof directoryFilters>;

/** Active directories, filtered; DR high to low by default (unmeasured last). */
export async function listDirectories(raw: DirectoryFilters = {}) {
  const f = directoryFilters.parse(raw);
  const where: SQL[] = [eq(directories.isActive, true)];
  if (f.niche) where.push(eq(directories.niche, f.niche));
  if (f.pricing) where.push(eq(directories.pricing, f.pricing));
  if (f.noBadge) where.push(eq(directories.badgeRequired, false));
  if (f.dofollow)
    where.push(
      sql`coalesce(nullif(${directories.linkTypeObserved}, 'unknown'), ${directories.linkTypeClaimed}) = 'dofollow'`,
    );
  if (f.q) where.push(sql`${directories.name} ilike ${`%${f.q.replace(/[%_\\]/g, "\\$&")}%`}`);
  const order =
    f.sort === "name"
      ? [asc(directories.name)]
      : f.sort === "acceptance"
        ? [sql`${directories.acceptanceRate} desc nulls last`, asc(directories.name)]
        : [sql`${directories.dr} desc nulls last`, asc(directories.name)];
  return db()
    .select()
    .from(directories)
    .where(and(...where))
    .orderBy(...order);
}

export async function getDirectory(slug: string) {
  return db().query.directories.findFirst({ where: and(eq(directories.slug, slug), eq(directories.isActive, true)) });
}

export async function allDirectoriesForAdmin() {
  return db()
    .select()
    .from(directories)
    .orderBy(desc(directories.isActive), sql`${directories.dr} desc nulls last`, asc(directories.name));
}

/** The link type we trust: what our checks observed, else what the directory claims. */
export function effectiveLinkType(d: Pick<Directory, "linkTypeObserved" | "linkTypeClaimed">) {
  return d.linkTypeObserved !== "unknown" ? d.linkTypeObserved : d.linkTypeClaimed;
}

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(min).max(max).nullable(),
  );
const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//.test(u), "Use an http(s) URL.");

export const directoryInput = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/)
    .default(""),
  url: httpUrl,
  submitUrl: z.preprocess((v) => (v === "" ? null : v), httpUrl.nullable()).default(null),
  description: z.string().trim().max(500).default(""),
  niche: z.enum(NICHES).default("general"),
  pricing: z.enum(PRICINGS).default("free"),
  dr: optionalInt(0, 100).default(null),
  linkTypeClaimed: z.enum(["dofollow", "nofollow", "unknown"]).default("unknown"),
  badgeRequired: z.boolean().default(false),
  needsAccount: z.boolean().default(true),
  guided: z.boolean().default(false),
  queueEstimateDays: optionalInt(0, 365).default(null),
  submissionNotes: z.string().trim().max(1000).default(""),
  instructions: z.string().trim().max(5000).default(""),
  isActive: z.boolean().default(true),
});
export type DirectoryInput = z.input<typeof directoryInput>;

export async function saveDirectory(raw: DirectoryInput, id?: string): Promise<Directory> {
  const input = directoryInput.parse(raw);
  const values = { ...input, slug: input.slug || slugify(input.name, 60) };
  if (id) {
    const [row] = await db().update(directories).set(values).where(eq(directories.id, id)).returning();
    return row;
  }
  const [row] = await db().insert(directories).values(values).returning();
  return row;
}

/** Parses CSV text (header row required). Handles quoted fields and doubled quotes. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim()));
  if (!header) return [];
  const keys = header.map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_"),
  );
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const truthy = (v: string | undefined) => (v === undefined || v === "" ? undefined : /^(1|true|yes|y)$/i.test(v));

/**
 * Upserts directories from CSV, matched by slug (or by URL host). Columns:
 * name, url, slug, submit_url, dr, niche, pricing, link_type, badge_required,
 * guided, queue_days, notes. Missing columns leave existing values alone.
 */
export async function importDirectoriesCsv(text: string) {
  const rows = parseCsv(text);
  const existing = await db().select().from(directories);
  const host = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  };
  const result = { created: 0, updated: 0, errors: [] as string[] };
  for (const [i, r] of rows.entries()) {
    const match =
      existing.find((d) => r.slug && d.slug === r.slug) ?? existing.find((d) => r.url && host(d.url) === host(r.url));
    const merged: Record<string, unknown> = {
      ...(match ?? {}),
      ...(r.name ? { name: r.name } : {}),
      ...(r.url ? { url: r.url } : {}),
      ...(r.slug ? { slug: r.slug } : {}),
      ...(r.submit_url !== undefined && r.submit_url !== "" ? { submitUrl: r.submit_url } : {}),
      ...(r.dr !== undefined && r.dr !== "" ? { dr: r.dr } : {}),
      ...(r.niche ? { niche: r.niche.toLowerCase() } : {}),
      ...(r.pricing ? { pricing: r.pricing.toLowerCase() } : {}),
      ...(r.link_type ? { linkTypeClaimed: r.link_type.toLowerCase() } : {}),
      ...(truthy(r.badge_required) !== undefined ? { badgeRequired: truthy(r.badge_required) } : {}),
      ...(truthy(r.guided) !== undefined ? { guided: truthy(r.guided) } : {}),
      ...(r.queue_days !== undefined && r.queue_days !== "" ? { queueEstimateDays: r.queue_days } : {}),
      ...(r.notes ? { submissionNotes: r.notes } : {}),
    };
    const parsed = directoryInput.safeParse(merged);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      result.errors.push(`Row ${i + 2}: ${issue?.path.join(".") || "row"} ${issue?.message ?? "is invalid"}`);
      continue;
    }
    try {
      await saveDirectory(parsed.data, match?.id);
      if (match) result.updated++;
      else result.created++;
    } catch {
      result.errors.push(`Row ${i + 2}: couldn't save (duplicate slug?)`);
    }
  }
  return result;
}

/**
 * Daily: acceptance rate, days to live and the observed link type per
 * directory, from every finished submission (DIY and done-for-you).
 */
export async function refreshDirectoryStats() {
  await db().execute(sql`
    update directories d set
      acceptance_rate = s.rate,
      avg_days_to_live = s.days,
      live_count = s.live,
      link_type_observed = coalesce(s.observed, d.link_type_observed)
    from (
      select directory_id,
        count(*) filter (where status in ('live', 'dead'))::float8
          / nullif(count(*) filter (where status in ('live', 'dead', 'rejected', 'replaced')), 0) as rate,
        avg(extract(epoch from (live_at - submitted_at)) / 86400)
          filter (where live_at is not null and submitted_at is not null) as days,
        count(*) filter (where status = 'live')::int as live,
        case
          when count(*) filter (where link_verdict = 'dofollow') > 0 then 'dofollow'::link_type
          when count(*) filter (where link_verdict = 'nofollow') > 0 then 'nofollow'::link_type
        end as observed
      from submissions group by directory_id
    ) s
    where s.directory_id = d.id
  `);
}
