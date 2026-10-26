import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { formatPostDate, publishedPosts } from "@/lib/blog/service";

export const metadata: Metadata = {
  title: "Blog",
  description: "Weekly recaps of every DebutYard debut, plus notes on launching software.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
};

export default function BlogIndex() {
  return (
    <Container className="max-w-3xl py-12">
      <Heading>Blog</Heading>
      <p className="mt-2 text-muted-foreground">
        Weekly recaps of every debut, plus notes on launching software.{" "}
        <a href="/blog/rss.xml" className="text-primary hover:underline">
          RSS
        </a>
      </p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-lg bg-muted/50" />}>
        <Posts />
      </Suspense>
    </Container>
  );
}

async function Posts() {
  await connection();
  const posts = await publishedPosts();
  if (posts.length === 0)
    return <p className="mt-8 text-muted-foreground">The first recap lands after week one closes.</p>;
  return (
    <ul className="mt-8 space-y-4">
      {posts.map((p) => (
        <li key={p.slug}>
          <Card className="p-5 transition-colors hover:border-primary/50">
            <p className="text-xs text-muted-foreground">
              {formatPostDate(p.publishedAt)}
              {p.kind === "recap" && " · Weekly recap"}
            </p>
            <Link href={`/blog/${p.slug}`} className="mt-1 block font-display text-xl font-semibold hover:text-primary">
              {p.title}
            </Link>
            {p.excerpt && <p className="mt-2 text-sm text-muted-foreground">{p.excerpt}</p>}
          </Card>
        </li>
      ))}
    </ul>
  );
}
