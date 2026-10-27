import "server-only";
import { env } from "@/env";

export type CronTask = [name: string, run: () => Promise<unknown>];

/** Runs a cron route's tasks in order after checking Vercel's bearer token. One failure doesn't stop the rest. */
export async function runCron(request: Request, tasks: CronTask[]): Promise<Response> {
  const secret = env().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const results: Record<string, unknown> = {};
  for (const [name, run] of tasks) {
    try {
      results[name] = await run();
    } catch (err) {
      console.error(`cron task ${name} failed`, err);
      results[name] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return Response.json(results);
}
