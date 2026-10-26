import Link from "next/link";
import { Logo } from "@/components/logo";
import { Container } from "@/components/ui/primitives";
import { site } from "@/config/site";

const links = [
  { href: "/pricing", label: "Pricing" },
  { href: "/refund-policy", label: "Refund policy" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Logo className="text-lg" />
          <p className="text-sm text-muted-foreground">{site.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <a href={`mailto:${site.supportEmail}`} className="hover:text-foreground">
            {site.supportEmail}
          </a>
        </nav>
      </Container>
    </footer>
  );
}
