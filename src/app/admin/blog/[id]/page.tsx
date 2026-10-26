import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { PostEditor } from "@/components/post-editor";
import { Container } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth";
import { getPost } from "@/lib/blog/service";

export const metadata: Metadata = { title: "Edit post · Admin", robots: { index: false } };

export default function EditPostPage(props: PageProps<"/admin/blog/[id]">) {
  return (
    <Container className="max-w-4xl py-10">
      <Link href="/admin/blog" className="text-sm text-muted-foreground hover:text-foreground">
        ← All posts
      </Link>
      <div className="mt-4">
        <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
          <Editor params={props.params} />
        </Suspense>
      </div>
    </Container>
  );
}

async function Editor({ params }: Pick<PageProps<"/admin/blog/[id]">, "params">) {
  await requireStaff();
  const { id } = await params;
  if (id === "new") {
    return (
      <PostEditor
        initial={{ id: null, title: "", slug: "", excerpt: "", body: "", coverUrl: "", status: "draft", kind: "post" }}
      />
    );
  }
  if (!z.string().uuid().safeParse(id).success) notFound();
  const post = await getPost(id);
  if (!post) notFound();
  return (
    <PostEditor
      initial={{
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        body: post.body,
        coverUrl: post.coverUrl ?? "",
        status: post.status,
        kind: post.kind,
      }}
    />
  );
}
