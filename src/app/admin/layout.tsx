import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/primitives";
import { getCurrentUser, isStaff } from "@/lib/auth";

const links = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/review", label: "Review queue" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/directories", label: "Directories" },
  { href: "/admin/ads", label: "Ads" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/newsletter", label: "Newsletter" },
  { href: "/admin/affiliates", label: "Affiliates" },
  { href: "/admin/users", label: "Admin users" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <Suspense>
        <AdminNav />
      </Suspense>
      {children}
    </>
  );
}

/** Only staff see the section links; everyone else gets the page's own sign-in or "admins only" view. */
async function AdminNav() {
  const user = await getCurrentUser().catch(() => null);
  if (!(await isStaff(user))) return null;
  return (
    <Container className="max-w-5xl pt-6">
      <nav className="flex flex-wrap gap-4 border-b border-border pb-3 text-sm">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
            {l.label}
          </Link>
        ))}
      </nav>
    </Container>
  );
}
