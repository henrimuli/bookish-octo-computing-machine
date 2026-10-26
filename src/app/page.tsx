import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProductLogo } from "@/components/board/product-logo";
import { FeaturedRail } from "@/components/board/featured-rail";
import { BoardSkeleton, WeekBoard } from "@/components/board/week-board";
import { NewsletterForm } from "@/components/newsletter-form";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container } from "@/components/ui/primitives";
import { featuredNow } from "@/lib/board/featured";
import { categoriesWithCounts, recentWinners } from "@/lib/board/queries";
import { addWeeks, formatWeekLabel, formatWeekRange, weekBounds, weekKeyFor } from "@/lib/weeks";

export default function Home() {
  return (
    <>
      <section className="border-b border-border">
        <Container className="flex flex-col gap-6 py-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Where great products <span className="text-primary">debut</span>.
            </h1>
            <p className="mt-4 max-w-xl text-muted-foreground">
              A new class debuts every Monday. Vote for your favourites all week; the top three become Debut of the
              Week.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/submit" size="lg">
              Debut your product
            </ButtonLink>
            <ButtonLink href="/pricing#submissions" size="lg" variant="outline">
              Get listed on 40+ directories
            </ButtonLink>
          </div>
        </Container>
      </section>

      <Container className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <Suspense
            fallback={
              <>
                <h2 className="mb-4 font-display text-2xl font-bold">This week&apos;s debuts</h2>
                <BoardSkeleton />
              </>
            }
          >
            <ThisWeek />
          </Suspense>
        </section>
        <aside className="space-y-6">
          <Suspense fallback={<Card className="h-48 animate-pulse" />}>
            <Sidebar />
          </Suspense>
        </aside>
      </Container>
    </>
  );
}

async function ThisWeek() {
  await connection();
  const now = new Date();
  const key = weekKeyFor(now);
  const daysLeft = Math.max(0, Math.ceil((weekBounds(key).endsAt.getTime() - now.getTime()) / 86_400_000));
  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-bold">This week&apos;s debuts</h2>
        <p className="text-sm text-muted-foreground">
          {formatWeekLabel(key)} · {formatWeekRange(key)} · voting closes in {daysLeft} day{daysLeft === 1 ? "" : "s"}
        </p>
      </div>
      <FeaturedRail items={await featuredNow(now)} />
      <WeekBoard weekKey={key} />
      <p className="mt-6 text-sm">
        <Link href={`/week/${addWeeks(key, -1)}`} className="text-muted-foreground hover:text-foreground">
          ← Last week&apos;s debuts
        </Link>
        <span className="mx-2 text-muted-foreground">·</span>
        <Link href="/weeks" className="text-muted-foreground hover:text-foreground">
          All weeks
        </Link>
      </p>
    </>
  );
}

async function Sidebar() {
  await connection();
  const [winners, categories] = await Promise.all([recentWinners(3), categoriesWithCounts()]);
  return (
    <>
      {winners.length > 0 && (
        <Card className="p-5">
          <h2 className="font-display font-semibold">Last week&apos;s winners</h2>
          <ol className="mt-3 space-y-3">
            {winners.map((w) => (
              <li key={`${w.period_key}-${w.place}`} className="flex items-center gap-3">
                <span>{["🥇", "🥈", "🥉"][w.place - 1]}</span>
                <ProductLogo name={w.name} src={w.logo_url} className="size-8" />
                <Link href={`/p/${w.slug}`} className="truncate text-sm font-medium hover:text-primary">
                  {w.name}
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}
      <Card className="p-5">
        <h2 className="font-display font-semibold">Browse by category</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {categories
            .filter((c) => c.count > 0)
            .slice(0, 16)
            .map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/category/${c.slug}`}
                  className="inline-block rounded-full bg-muted px-3 py-1 text-xs hover:text-primary"
                >
                  {c.name} <span className="text-muted-foreground">{c.count}</span>
                </Link>
              </li>
            ))}
        </ul>
        <Link href="/categories" className="mt-3 inline-block text-sm text-primary hover:underline">
          All categories
        </Link>
      </Card>
      <Card className="p-5">
        <h2 className="font-display font-semibold">Get the Monday digest</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          Last week&apos;s winners and this week&apos;s debuts. One email, no spam.
        </p>
        <NewsletterForm source="home" />
      </Card>
      <Card className="p-5">
        <h2 className="font-display font-semibold">Fair by design</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Paid debuts buy placement, never votes. No multipliers, no head starts.{" "}
          <Link href="/how-ranking-works" className="text-primary hover:underline">
            How ranking works
          </Link>
        </p>
      </Card>
    </>
  );
}
