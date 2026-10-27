import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductLogo } from "@/components/board/product-logo";
import { SimpleList } from "@/components/board/simple-list";
import { Badge, Container, Heading } from "@/components/ui/primitives";
import { proUserIds } from "@/lib/billing/service";
import { builderByHandle } from "@/lib/board/queries";

export async function generateMetadata(props: PageProps<"/builders/[handle]">): Promise<Metadata> {
  const { handle } = await props.params;
  const b = await builderByHandle(handle).catch(() => null);
  if (!b) return {};
  return { title: `${b.user.name} on DebutYard`, description: `Products built by ${b.user.name}.` };
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
  const pro = (await proUserIds([b.user.id])).has(b.user.id);
  const totalVotes = b.products.reduce((sum, p) => sum + p.votes, 0);
  return (
    <>
      <div className="flex items-center gap-4">
        <ProductLogo name={b.user.name} src={b.user.image} className="size-16 rounded-full" />
        <div>
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
        </div>
      </div>
      <div className="mt-8">
        {b.products.length ? (
          <SimpleList items={b.products} />
        ) : (
          <p className="text-muted-foreground">No debuts yet.</p>
        )}
      </div>
    </>
  );
}
