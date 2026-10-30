/**
 * One-off: creates perk tasks (newsletter mentions, launch posts) for paid
 * debuts bought before they were tracked, where the launch week is this week
 * or later. Safe to re-run: existing tasks are left alone.
 *
 *   pnpm tsx --conditions=react-server scripts/backfill-perk-tasks.ts
 *
 * (`react-server` makes the app's `server-only` imports a no-op outside Next.)
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const { backfillPerkTasks } = await import("../src/lib/perks/service");
  const created = await backfillPerkTasks();
  console.log(`Created ${created} perk task${created === 1 ? "" : "s"}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
