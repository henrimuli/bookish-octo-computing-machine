import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SimpleList } from "@/components/board/simple-list";
import { WallLinks } from "@/components/links/wall-links";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Container, Heading } from "@/components/ui/primitives";
import { proUserIds } from "@/lib/billing/service";
import { builderByHandle } from "@/lib/board/queries";
import { onLaunchWall, wallLinks } from "@/lib/links/wall";
import { socialHandle } from "@/lib/profile";

export async function generateMetadata(props: PageProps<"/builders/[handle]">): Promise<Metadata> {
  const { handle } = await props.params;
  const b = await builderByHandle(handle).catch(() => null);
  if (!b) return {};
  return { title: `${b.user.name} on DebutYard`, description: b.user.bio ?? `Products built by ${b.user.name}.` };
}

export default function BuilderPage(props: PageProps<"/builders/[handle]">) {
  return (
    <Container className="max-w-4xl py-12">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Builder params={props.params} />
      </Suspense>
    </Container>
  );
}

async function Builder({ params }: { params: PageProps<"/builders/[handle]">["params"] }) {
  const { handle } = await params;
  const b = await builderByHandle(handle);
  if (!b) notFound();
  const [pros, wall] = await Promise.all([proUserIds([b.user.id]), onLaunchWall(b.user.id)]);
  const pro = pros.has(b.user.id);
  const links = wall ? await wallLinks(b.user.id) : [];
  const totalVotes = b.products.reduce((sum, p) => sum + p.votes, 0);
  return (
    <>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar name={b.user.name} src={b.user.image} className="size-20 text-3xl sm:size-24" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Heading className="text-3xl sm:text-3xl">{b.user.name}</Heading>
            {pro && (
              <Badge tone="primary" title="Maker Pro member">
                Pro
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            @{b.user.handle} · {b.products.length} debut{b.products.length === 1 ? "" : "s"} · ▲ {totalVotes}
          </p>
          {b.user.bio && <p className="mt-3 max-w-2xl text-pretty">{b.user.bio}</p>}
          {(b.user.xUrl || b.user.githubUrl) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {b.user.xUrl && <SocialLink href={b.user.xUrl} kind="x" />}
              {b.user.githubUrl && <SocialLink href={b.user.githubUrl} kind="github" />}
            </div>
          )}
        </div>
      </div>
      <div className="mt-8">
        {b.products.length ? (
          <SimpleList items={b.products} />
        ) : (
          <p className="text-muted-foreground">No debuts yet.</p>
        )}
      </div>
      {links.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold">Verified links</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            {links.filter((l) => l.verdict === "dofollow").length} dofollow of {links.length} live links, checked by
            DebutYard.
          </p>
          <WallLinks links={links} />
        </section>
      )}
    </>
  );
}

const socialIcons = {
  x: "M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.2h1.7L7.4 4.7H5.58l11.09 14.5Z",
  github:
    "M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z",
} as const;

function SocialLink({ href, kind }: { href: string; kind: keyof typeof socialIcons }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="me noopener"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-primary/40 hover:text-primary"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <path d={socialIcons[kind]} />
      </svg>
      <span className="sr-only">{kind === "x" ? "X" : "GitHub"}: </span>@{socialHandle(href)}
    </a>
  );
}
