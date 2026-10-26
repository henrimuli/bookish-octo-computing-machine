import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { UserMenu } from "@/components/user-menu";

const nav = [
  { href: "/", label: "This week" },
  { href: "/weeks", label: "Past weeks" },
  { href: "/categories", label: "Categories" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {/* The session is request data, so it streams in behind a boundary. */}
        <Suspense
          fallback={
            <ButtonLink href="/sign-in" variant="ghost" size="sm">
              Sign in
            </ButtonLink>
          }
        >
          <UserMenu />
        </Suspense>
      </Container>
    </header>
  );
}
