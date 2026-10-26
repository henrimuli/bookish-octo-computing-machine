import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./supabase/migrations",
  // Timestamped file names so the Supabase CLI can track and apply them.
  migrations: { prefix: "supabase" },
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    // Migrations need a direct (non-pooled) connection.
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
