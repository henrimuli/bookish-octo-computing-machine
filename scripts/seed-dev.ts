/**
 * Fills a local/dev database with sample makers, products, applause and comments
 * across last week, this week and next week. Refuses to run in production.
 *
 *   pnpm db:seed
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomBytes } from "node:crypto";
import * as schema from "../src/db/schema";
import { addWeeks, weekBounds, weekKeyFor } from "../src/lib/weeks";

const SAMPLES: Array<[string, string, string, string[]]> = [
  ["Inkwell", "inkwell.dev", "Write docs your users actually finish reading", ["writing", "developer-tools"]],
  ["Tallyhoo", "tallyhoo.app", "Shared budgets for households that hate spreadsheets", ["finance", "productivity"]],
  ["Pixelpour", "pixelpour.io", "Turn screenshots into polished launch images", ["design", "image"]],
  ["Querybird", "querybird.ai", "Ask your Postgres questions in plain English", ["ai", "data"]],
  ["Shipnote", "shipnote.so", "Changelogs your customers subscribe to", ["marketing", "productivity"]],
  ["Murmur", "murmur.fm", "Ambient soundscapes that adapt to your focus", ["audio", "health"]],
  ["Formcraft", "formcraft.app", "Forms that feel like a conversation", ["no-code", "productivity"]],
  ["Leadlantern", "leadlantern.com", "Find the subreddits where your customers hang out", ["marketing", "ai"]],
  ["Patchwork", "patchwork.tools", "Visual diff for design systems", ["design", "developer-tools"]],
  ["Hearth", "hearth.chat", "Private group chat for small communities", ["communication", "social-media"]],
];

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to seed a production database.");
  }
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL");
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema, casing: "snake_case" });

  const now = new Date();
  const thisWeek = weekKeyFor(now);
  const weeks = [addWeeks(thisWeek, -1), thisWeek, addWeeks(thisWeek, 1)];
  for (const key of weeks) {
    const { startsAt, endsAt } = weekBounds(key);
    await db.insert(schema.launchWeeks).values({ key, startsAt, endsAt }).onConflictDoNothing();
  }

  const users = Array.from({ length: 12 }, (_, i) => ({
    id: `seed-user-${i}`,
    name: ["Ada", "Ben", "Chen", "Dana", "Eli", "Fay", "Gus", "Hana", "Ivo", "Jo", "Kai", "Lea"][i] + " Maker",
    email: `seed${i}@example.com`,
    handle: `seed-${i}`,
    emailVerified: true,
    createdAt: new Date(now.getTime() - 30 * 86_400_000),
  }));
  await db.insert(schema.user).values(users).onConflictDoNothing();

  for (const [i, [name, domain, tagline, cats]] of SAMPLES.entries()) {
    const week = i < 3 ? weeks[0] : i < 8 ? weeks[1] : weeks[2];
    const [p] = await db
      .insert(schema.products)
      .values({
        slug: name.toLowerCase(),
        name,
        tagline,
        description: `${name} is a sample product for local development. ${tagline}. It exists so you can see how the board, product pages and dashboard look with data.`,
        websiteUrl: `https://${domain}/`,
        domain,
        pricingModel: i % 3 === 0 ? "free" : "freemium",
        status: "approved",
        tier: i === 4 ? "pro" : "free",
        launchWeekKey: week,
        createdBy: users[i].id,
        submittedAt: now,
        approvedAt: new Date(now.getTime() - (10 - i) * 3_600_000),
      })
      .onConflictDoNothing()
      .returning();
    if (!p) continue;
    await db.insert(schema.productCategories).values(cats.map((c) => ({ productId: p.id, categorySlug: c })));
    await db.insert(schema.badgeVerifications).values({ productId: p.id, dnsToken: randomBytes(12).toString("hex") });

    if (week === weeks[2]) continue; // next week's products can't have applause yet
    const applauseCount = (i * 7) % 11;
    const { startsAt } = weekBounds(week);
    for (let v = 0; v < applauseCount; v++) {
      await db
        .insert(schema.applause)
        .values({
          productId: p.id,
          userId: users[v].id,
          createdAt: new Date(Math.min(now.getTime(), startsAt.getTime() + v * 9 * 3_600_000)),
        })
        .onConflictDoNothing();
    }
    if (i % 2 === 0) {
      await db.insert(schema.comments).values({
        productId: p.id,
        userId: users[(i + 1) % users.length].id,
        body: `Love the idea behind ${name}. How are you thinking about pricing for small teams?`,
        createdAt: new Date(Math.min(now.getTime(), startsAt.getTime() + 3_600_000)),
      });
    }
  }
  console.log(`Seeded ${SAMPLES.length} products across ${weeks.join(", ")}.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
