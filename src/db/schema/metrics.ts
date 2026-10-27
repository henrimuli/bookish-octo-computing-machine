import { index, integer, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Domain Rating snapshots: DR before/after charts, Maker Pro tracking, the free DR checker's cache. */
export const domainMetrics = pgTable(
  "domain_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: text("domain").notNull(),
    /** 0–100, on the provider's scale (Open PageRank's 0–10 is scaled up). */
    dr: real("dr").notNull(),
    referringDomains: integer("referring_domains"),
    provider: text("provider").notNull(),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("domain_metrics_domain_idx").on(t.domain, t.measuredAt)],
);
