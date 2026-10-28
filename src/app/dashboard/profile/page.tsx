import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ProfileForm } from "@/components/profile-form";
import { Card } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { uploadsEnabled } from "@/lib/products/queries";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" description="How you appear on your builder page and next to your products." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted/50" />}>
        <Profile />
      </Suspense>
    </div>
  );
}

async function Profile() {
  const user = await requireUser("/dashboard/profile");
  const row = await db().query.user.findFirst({
    where: eq(schema.user.id, user.id),
    columns: { name: true, image: true, bio: true, xUrl: true, githubUrl: true, handle: true },
  });
  if (!row) return null;
  return (
    <Card>
      <ProfileForm
        initial={{
          name: row.name,
          image: row.image ?? "",
          bio: row.bio ?? "",
          x: row.xUrl ?? "",
          github: row.githubUrl ?? "",
        }}
        uploadsEnabled={uploadsEnabled()}
      />
      {row.handle && (
        <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
          Your public page:{" "}
          <Link href={`/builders/${row.handle}`} className="text-primary hover:underline">
            /builders/{row.handle}
          </Link>
        </p>
      )}
    </Card>
  );
}
