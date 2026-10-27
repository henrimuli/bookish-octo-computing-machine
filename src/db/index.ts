import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Database };

function createDb(): Database {
  const url = env().DATABASE_URL;
  if (!url) throw new Error("Missing environment variables: DATABASE_URL");
  const client = postgres(url, {
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    max: env().NODE_ENV === "production" ? 5 : 3,
    // Serverless instances are reused and suspended between requests. Without
    // these, idle connections live forever: they hold pooler slots, and once the
    // pooler drops them, a query sent on one waits for a reply that never comes
    // (pages that run several queries at once hang on "Loading…").
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

/** Lazily created so builds and tests that never touch the DB don't need DATABASE_URL. */
export function db(): Database {
  globalForDb.__db ??= createDb();
  return globalForDb.__db;
}

export { schema };
