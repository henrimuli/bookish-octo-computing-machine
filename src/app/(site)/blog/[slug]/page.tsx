import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NewsletterForm } from "@/components/newsletter-form";
import { Card, Container } from "@/components/ui/primitives";
import { site } from "@/config/site";
import { renderMarkdown } from "@/lib/blog/markdown";
import { formatPostDate, publishedPost } from "@/lib/blog/service";

export async function generateMetadata(props: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await publishedPost(slug).catch(() => null);
  if (!post) return { title: "Blog", robots: { index: false } };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      images: post.coverUrl ? [post.coverUrl] : undefined,
    },
  };
}

export default function BlogPost(props: PageProps<"/blog/[slug]">) {
  return (
    <Container className="max-w-3xl py-12">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted/50" />}>
        <Post params={props.params} />
      </Suspense>
    </Container>
  );
}

async function Post({ params }: Pick<PageProps<"/blog/[slug]">, "params">) {
  const { slug } = await params;
  const post = await publishedPost(slug);
  if (!post) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Organization", name: site.name },
    image: post.coverUrl ?? undefined,
  };
  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground">
        ← Blog
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">{post.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {formatPostDate(post.publishedAt)}
        {post.authorName && ` · ${post.authorName}`}
      </p>
      {post.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverUrl} alt="" className="mt-6 w-full rounded-lg border border-border" />
      )}
      <div className="prose-dy mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }} />
      <Card className="mt-12 p-6">
        <h2 className="font-display font-semibold">Get every recap by email</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">One email each Monday: winners and new debuts.</p>
        <NewsletterForm source="blog" className="max-w-md" />
      </Card>
    </article>
  );
}
