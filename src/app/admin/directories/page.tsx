import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CsvImport } from "@/components/directories/csv-import";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, Container, Heading } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth";
import { allDirectoriesForAdmin, effectiveLinkType } from "@/lib/directories/service";

export const metadata: Metadata = { title: "Directories · Admin", robots: { index: false } };

export default function DirectoriesAdminPage() {
  return (
    <Container className="max-w-6xl py-10">
      <div className="flex items-center justify-between gap-4">
        <Heading>Directories</Heading>
        <ButtonLink href="/admin/directories/new">Add directory</ButtonLink>
      </div>
      <Card className="mt-6 p-5">
        <h2 className="font-display font-semibold">Import CSV</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          Rows match existing directories by slug or website host; empty cells leave values alone. Use it to load DR
          from your own Ahrefs or Moz export.
        </p>
        <CsvImport />
      </Card>
      <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
        <List />
      </Suspense>
    </Container>
  );
}

async function List() {
  await requireStaff();
  const rows = await allDirectoriesForAdmin();
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Directory</th>
            <th className="px-3 py-2 font-medium">DR</th>
            <th className="px-3 py-2 font-medium">Niche</th>
            <th className="px-3 py-2 font-medium">Link</th>
            <th className="px-3 py-2 font-medium">Flags</th>
            <th className="px-3 py-2 text-right font-medium">Accepted</th>
            <th className="px-3 py-2 text-right font-medium">Live</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((d) => (
            <tr key={d.id} className={d.isActive ? "" : "opacity-50"}>
              <td className="px-3 py-2">
                <Link href={`/admin/directories/${d.id}`} className="font-medium hover:text-primary">
                  {d.name}
                </Link>
              </td>
              <td className="px-3 py-2 tabular-nums">{d.dr ?? "–"}</td>
              <td className="px-3 py-2">{d.niche}</td>
              <td className="px-3 py-2">{effectiveLinkType(d)}</td>
              <td className="space-x-1 px-3 py-2">
                {d.badgeRequired && <Badge tone="accent">badge</Badge>}
                {d.guided && <Badge tone="accent">guided</Badge>}
                {d.instructions && <Badge>instructions</Badge>}
                {!d.isActive && <Badge>inactive</Badge>}
                {d.auditFailures > 0 && (
                  <Badge tone="accent" title={d.auditError ?? undefined}>
                    {d.isActive ? `audit failed ×${d.auditFailures}` : "down (audit)"}
                  </Badge>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {d.acceptanceRate !== null ? `${Math.round(d.acceptanceRate * 100)}%` : "–"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{d.liveCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
