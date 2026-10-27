import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "@/env";

export type CronTask = [name: string, run: () => Promise<unknown>];

/**
 * Runs a cron route's tasks in order after checking Vercel's bearer token.
 * One failure doesn't stop the rest. Each run is logged to `cron_runs` for
 * the admin dashboard; logging problems never block the tasks.
 */
export async function runCron(request: Request, job: string, tasks: CronTask[]): Promise<Response> {
  const secret = env().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const runId = await db()
    .insert(schema.cronRuns)
    .values({ job, startedAt: new Date() })
    .returning({ id: schema.cronRuns.id })
    .then((r) => r[0]?.id)
    .catch((err) => console.error("cron run log failed", err));

  const results: Record<string, unknown> = {};
  const failed: string[] = [];
  for (const [name, run] of tasks) {
    try {
      results[name] = await run();
    } catch (err) {
      console.error(`cron task ${name} failed`, err);
      failed.push(name);
      results[name] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  if (runId) {
    await db()
      .update(schema.cronRuns)
      .set({ finishedAt: new Date(), failed, results: JSON.parse(JSON.stringify(results)) })
      .where(eq(schema.cronRuns.id, runId))
      .catch((err) => console.error("cron run log failed", err));
  }
  return Response.json(results);
}
