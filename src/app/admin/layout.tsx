import Link from "next/link";
import { Container } from "@/components/ui/primitives";

const links = [
  { href: "/admin", label: "Review queue" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/newsletter", label: "Newsletter" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <Container className="max-w-5xl pt-6">
        <nav className="flex flex-wrap gap-4 border-b border-border pb-3 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
      </Container>
      {children}
    </>
  );
}
