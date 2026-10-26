import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { DirectoryEditor } from "@/components/directories/directory-editor";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit directory · Admin", robots: { index: false } };

export default function EditDirectoryPage(props: PageProps<"/admin/directories/[id]">) {
  return (
    <Container className="max-w-4xl py-10">
      <Link href="/admin/directories" className="text-sm text-muted-foreground hover:text-foreground">
        ← All directories
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">Loading…</p>}>
        <Editor params={props.params} />
      </Suspense>
    </Container>
  );
}

const blank = {
  name: "",
  slug: "",
  url: "",
  submitUrl: "",
  description: "",
  niche: "general" as const,
  pricing: "free" as const,
  dr: "",
  linkTypeClaimed: "unknown" as const,
  badgeRequired: false,
  needsAccount: true,
  guided: false,
  queueEstimateDays: "",
  submissionNotes: "",
  instructions: "",
  isActive: true,
};

async function Editor({ params }: Pick<PageProps<"/admin/directories/[id]">, "params">) {
  await requireStaff();
  const { id } = await params;
  if (id === "new") {
    return (
      <>
        <Heading className="mt-4">Add directory</Heading>
        <Card className="mt-6 p-6">
          <DirectoryEditor id={null} initial={blank} />
        </Card>
      </>
    );
  }
  if (!z.string().uuid().safeParse(id).success) notFound();
  const d = await db().query.directories.findFirst({ where: eq(schema.directories.id, id) });
  if (!d) notFound();
  return (
    <>
      <Heading className="mt-4">{d.name}</Heading>
      <p className="mt-1 text-sm text-muted-foreground">
        Observed link type: {d.linkTypeObserved} · {d.liveCount} live listings tracked
      </p>
      <Card className="mt-6 p-6">
        <DirectoryEditor
          id={d.id}
          initial={{
            ...blank,
            ...d,
            submitUrl: d.submitUrl ?? "",
            dr: d.dr?.toString() ?? "",
            queueEstimateDays: d.queueEstimateDays?.toString() ?? "",
          }}
        />
      </Card>
    </>
  );
}
