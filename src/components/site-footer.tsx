import Link from "next/link";
import { Logo } from "@/components/logo";
import { NewsletterForm } from "@/components/newsletter-form";
import { Container } from "@/components/ui/primitives";
import { site } from "@/config/site";
import { drEnabled } from "@/lib/metrics/service";

const links: Array<{ href: string; label: string; dr?: boolean }> = [
  { href: "/blog", label: "Blog" },
  { href: "/advertise", label: "Advertise" },
  { href: "/submission-service", label: "Submission service" },
  { href: "/directories", label: "Directories" },
  { href: "/launch-wall", label: "Launch wall" },
  { href: "/tools/launch-readiness", label: "Readiness check" },
  { href: "/tools/dofollow-checker", label: "Dofollow checker" },
  { href: "/tools/dr-checker", label: "DR checker", dr: true },
  { href: "/docs", label: "API & MCP" },
  { href: "/refund-policy", label: "Refund policy" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border print:hidden">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Logo className="text-lg" />
          <p className="text-sm text-muted-foreground">{site.tagline}</p>
          <div className="pt-2">
            <p className="mb-2 text-sm font-medium">Weekly digest: winners and new debuts, every Monday.</p>
            <NewsletterForm source="footer" className="max-w-sm" />
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {links
            .filter((l) => !l.dr || drEnabled())
            .map((l) => (
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
