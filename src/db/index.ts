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
  // Supabase's transaction pooler does not support prepared statements.
  const client = postgres(url, { prepare: false, max: env().NODE_ENV === "production" ? 5 : 3 });
  return drizzle(client, { schema, casing: "snake_case" });
}

/** Lazily created so builds and tests that never touch the DB don't need DATABASE_URL. */
export function db(): Database {
  globalForDb.__db ??= createDb();
  return globalForDb.__db;
}

export { schema };
