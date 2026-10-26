import "server-only";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { trackedLinks, launchWallProfiles, submissions, directories } = schema;

/**
 * Only links our own checks found live (dofollow or nofollow) are shown.
 * Nothing the maker reports themselves.
 */
const VERIFIED = ["dofollow", "nofollow"] as const;
const verified = and(
  eq(trackedLinks.active, true),
  inArray(trackedLinks.lastVerdict, [...VERIFIED]),
  isNotNull(trackedLinks.lastCheckedAt),
);

export async function onLaunchWall(userId: string) {
  return Boolean(await db().query.launchWallProfiles.findFirst({ where: eq(launchWallProfiles.userId, userId) }));
}

export async function setLaunchWall(userId: string, on: boolean) {
  if (on) await db().insert(launchWallProfiles).values({ userId }).onConflictDoNothing();
  else await db().delete(launchWallProfiles).where(eq(launchWallProfiles.userId, userId));
  return on;
}

/** A maker's verified live links, dofollow first, for their builder profile. */
export async function wallLinks(userId: string) {
  return db()
    .select({
      id: trackedLinks.id,
      url: trackedLinks.url,
      target: trackedLinks.targetDomain,
      verdict: trackedLinks.lastVerdict,
      checkedAt: trackedLinks.lastCheckedAt,
      directory: directories.name,
      directoryDr: directories.dr,
    })
    .from(trackedLinks)
    .leftJoin(submissions, eq(submissions.id, trackedLinks.submissionId))
    .leftJoin(directories, eq(directories.id, submissions.directoryId))
    .where(and(eq(trackedLinks.ownerUserId, userId), verified))
    .orderBy(
      sql`case ${trackedLinks.lastVerdict} when 'dofollow' then 0 else 1 end`,
      desc(sql`coalesce(${directories.dr}, 0)`),
      trackedLinks.url,
    );
}

/** Opted-in makers with at least one verified link, most dofollow links first. */
export async function launchWall(limit = 200) {
  const dofollow = sql<number>`count(*) filter (where ${trackedLinks.lastVerdict} = 'dofollow')::int`;
  return db()
    .select({
      userId: schema.user.id,
      name: schema.user.name,
      handle: schema.user.handle,
      image: schema.user.image,
      dofollow,
      total: sql<number>`count(*)::int`,
      domains: sql<string[]>`array_agg(distinct ${trackedLinks.targetDomain})`,
    })
    .from(launchWallProfiles)
    .innerJoin(schema.user, eq(schema.user.id, launchWallProfiles.userId))
    .innerJoin(trackedLinks, and(eq(trackedLinks.ownerUserId, launchWallProfiles.userId), verified))
    .where(isNotNull(schema.user.handle))
    .groupBy(schema.user.id)
    .orderBy(desc(dofollow), desc(sql`count(*)`), schema.user.name)
    .limit(limit);
}
