import type { Metadata } from "next";
import Link from "next/link";
import { asc, count, eq, inArray, sql } from "drizzle-orm";
import { Suspense } from "react";
import { ProductLogo } from "@/components/board/product-logo";
import { ReviewControls } from "@/components/review-controls";
import { Badge, Card, Heading } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/auth";
import { TIERS } from "@/lib/products/input";
import { formatWeekLabel, upcomingWeekKeys, weekKeyFor } from "@/lib/weeks";

export const metadata: Metadata = { title: "Review queue · Admin", robots: { index: false } };

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Heading className="text-2xl sm:text-3xl">Review queue</Heading>
      <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
        <Queue />
      </Suspense>
    </div>
  );
}

async function Queue() {
  await requireStaff("/admin/review");
  const { products, user, productCategories } = schema;

  const pending = await db()
    .select({ p: products, makerEmail: user.email, makerName: user.name })
    .from(products)
    .innerJoin(user, eq(user.id, products.createdBy))
    .where(eq(products.status, "pending"))
    // Paid tiers first (they're promised fast review), then oldest first.
    .orderBy(sql`case when ${products.tier} = 'free' then 1 else 0 end`, asc(products.submittedAt));

  const cats = pending.length
    ? await db()
        .select({ productId: productCategories.productId, slug: productCategories.categorySlug })
        .from(productCategories)
        .where(
          inArray(
            productCategories.productId,
            pending.map((r) => r.p.id),
          ),
        )
    : [];
  const catsBy = new Map<string, string[]>();
  for (const c of cats) catsBy.set(c.productId, [...(catsBy.get(c.productId) ?? []), c.slug]);

  const weeks = [weekKeyFor(new Date()), ...upcomingWeekKeys(new Date(), 4)];
  const load = await db()
    .select({ week: products.launchWeekKey, tier: products.tier, n: count() })
    .from(products)
    .where(eq(products.status, "approved"))
    .groupBy(products.launchWeekKey, products.tier);

  return (
    <div className="mt-8 space-y-8">
      <section className="grid gap-3 sm:grid-cols-5">
        {weeks.map((w) => {
          const rows = load.filter((l) => l.week === w);
          const free = rows.find((r) => r.tier === "free")?.n ?? 0;
          const paid = rows.filter((r) => r.tier !== "free").reduce((s, r) => s + r.n, 0);
          return (
            <Card key={w} className="p-4 text-sm">
              <p className="font-medium">{formatWeekLabel(w)}</p>
              <p className="text-muted-foreground">
                {free} free · {paid} paid
              </p>
            </Card>
          );
        })}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Pending ({pending.length})</h2>
        {pending.length === 0 && <p className="text-muted-foreground">Nothing to review.</p>}
        {pending.map(({ p, makerEmail, makerName }) => (
          <Card key={p.id} className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_260px]">
            <div className="flex gap-4">
              <ProductLogo name={p.name} src={p.logoUrl} />
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/p/${p.slug}`} className="font-semibold hover:text-primary">
                    {p.name}
                  </Link>
                  <Badge tone={p.tier === "free" ? "default" : "accent"}>{TIERS[p.tier].label}</Badge>
                  {p.requestedWeekKey && <Badge>wants {formatWeekLabel(p.requestedWeekKey)}</Badge>}
                </div>
                <p className="text-sm">{p.tagline}</p>
                <a
                  href={p.websiteUrl}
                  target="_blank"
                  rel="nofollow noopener"
                  className="text-sm text-primary hover:underline"
                >
                  {p.websiteUrl}
                </a>
                <p className="line-clamp-3 text-sm text-muted-foreground">{p.description}</p>
                <p className="text-xs text-muted-foreground">
                  {makerName} · {makerEmail} · {(catsBy.get(p.id) ?? []).join(", ")} · submitted{" "}
                  {p.submittedAt?.toUTCString().slice(0, 22)}
                </p>
              </div>
            </div>
            <ReviewControls productId={p.id} paid={p.tier !== "free"} />
          </Card>
        ))}
      </section>
    </div>
  );
}
