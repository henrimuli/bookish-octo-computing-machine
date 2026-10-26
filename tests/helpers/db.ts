import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Wipes the test database and applies every migration. */
export async function resetDatabase(url: string) {
  const admin = postgres(url, { max: 1, onnotice: () => {} });
  await admin.unsafe(
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
  );
  await migrate(drizzle(admin), { migrationsFolder: "drizzle" });
  await admin.end();
}
