import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { freeTools } from "@/components/tools/tool-list";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { UserMenu } from "@/components/user-menu";

const nav = [
  { href: "/", label: "This week" },
  { href: "/weeks", label: "Past weeks" },
  { href: "/categories", label: "Categories" },
  { href: "/directories", label: "Directories" },
] as const;

/** Sticky on every public page; pages that stick things below it offset by its h-16. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur print:hidden">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
            <FreeToolsMenu />
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

/** Opens on hover, or on focus for keyboard and touch; CSS only, so the header stays a server component. */
function FreeToolsMenu() {
  return (
    <div className="group/tools relative">
      <button
        type="button"
        aria-haspopup="true"
        className="inline-flex h-16 items-center gap-1 hover:text-foreground group-focus-within/tools:text-foreground"
      >
        Free Tools
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className="size-3.5 transition-transform group-hover/tools:rotate-180 group-focus-within/tools:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {/* pt bridges the gap so moving the pointer down doesn't close it. */}
      <div className="invisible absolute left-1/2 top-full w-96 -translate-x-1/2 translate-y-1 pt-0 opacity-0 transition duration-150 group-hover/tools:visible group-hover/tools:translate-y-0 group-hover/tools:opacity-100 group-focus-within/tools:visible group-focus-within/tools:translate-y-0 group-focus-within/tools:opacity-100">
        <ul className="space-y-1 rounded-2xl border border-border bg-card p-2 shadow-xl">
          {freeTools().map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="group/item flex gap-3.5 rounded-xl p-3 transition-colors hover:bg-muted">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover/item:bg-primary group-hover/item:text-primary-foreground">
                  {t.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{t.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{t.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
