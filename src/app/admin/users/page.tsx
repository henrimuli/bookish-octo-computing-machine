import type { Metadata } from "next";
import { Suspense } from "react";
import { AddAdmin, RemoveAdmin } from "@/components/admin/admin-users";
import { Badge, Card, Container, Heading } from "@/components/ui/primitives";
import { listAdmins } from "@/lib/admin/users";
import { normalizeEmail, requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin users · Admin", robots: { index: false } };

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function AdminUsersPage() {
  return (
    <Container className="max-w-5xl py-10">
      <Heading>Admin users</Heading>
      <p className="mt-2 text-muted-foreground">
        People who can open the admin area. They sign in with the email listed here. Every role has full access for now;
        roles are stored so permissions can be split later.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
        <Body />
      </Suspense>
    </Container>
  );
}

async function Body() {
  const me = await requireStaff("/admin/users");
  const admins = await listAdmins();
  const myEmail = normalizeEmail(me.email);
  return (
    <div className="mt-8 space-y-8">
      <Card className="p-5">
        <h2 className="font-medium">Add someone</h2>
        <div className="mt-3">
          <AddAdmin />
        </div>
      </Card>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {admins.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <span className="break-all">{a.name ?? a.email}</span>
                <Badge tone={a.role === "owner" ? "primary" : "default"}>{a.role}</Badge>
                {a.email === myEmail && <span className="text-xs text-muted-foreground">(you)</span>}
              </p>
              <p className="mt-0.5 break-all text-sm text-muted-foreground">
                {a.name ? `${a.email} · ` : ""}
                {a.hasAccount ? "" : "hasn't signed up yet · "}
                {a.lastSeenAt ? `last seen ${dateFmt.format(a.lastSeenAt)}` : "never opened admin"}
              </p>
            </div>
            {a.role !== "owner" && a.email !== myEmail && <RemoveAdmin id={a.id} email={a.email} />}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        The owner comes from <code>ADMIN_EMAIL</code>. To change the owner, change that variable and redeploy.
      </p>
    </div>
  );
}
