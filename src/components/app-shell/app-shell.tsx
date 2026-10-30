"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/app-shell/icons";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  /** Shown at the end of the row, e.g. an unread count. */
  badge?: ReactNode;
};
export type NavGroup = { label?: string; items: NavItem[] };

/**
 * Internal app frame: a fixed sidebar on desktop, a drawer on mobile. No site
 * header or footer. `footer` sits at the bottom of the sidebar (account, sign out).
 */
export function AppShell({
  area,
  badge,
  groups,
  actions,
  footer,
  children,
}: {
  /** Names the area in the mobile top bar, e.g. "Dashboard" or "Admin". */
  area: string;
  /** Optional tag beside the sidebar logo; only admin uses one. */
  badge?: string;
  groups: NavGroup[];
  /** Primary buttons under the logo. */
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 px-5">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <LogoMark className="size-7" />
          <span>
            Debut<span className="text-primary">Yard</span>
          </span>
        </Link>
        {badge && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      {actions && <div className="px-4 pb-2">{actions}</div>}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {/* The current path is request data on dynamic routes, so highlight the active link once it streams in. */}
        <Suspense fallback={<NavLinks groups={groups} pathname={null} onNavigate={() => setOpen(false)} />}>
          <ActiveNavLinks groups={groups} onNavigate={() => setOpen(false)} />
        </Suspense>
      </nav>
      {footer && <div className="border-t border-border p-3">{footer}</div>}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border bg-card lg:block print:hidden">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-40 lg:hidden", open ? "" : "pointer-events-none")} aria-hidden={!open}>
        <div
          className={cn("absolute inset-0 bg-black/40 transition-opacity", open ? "opacity-100" : "opacity-0")}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-card shadow-xl transition-transform",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Close menu"
          >
            <Icon name="close" className="size-5" />
          </button>
          {sidebar}
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur lg:hidden print:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Open menu"
          >
            <Icon name="menu" className="size-5" />
          </button>
          <Link href="/" className="flex items-center gap-2 font-display font-bold">
            <LogoMark className="size-6" />
            {area}
          </Link>
        </header>
        <main className="flex-1 px-4 pb-16 pt-6 sm:px-8 lg:pt-10">{children}</main>
      </div>
    </div>
  );
}

function ActiveNavLinks(props: { groups: NavGroup[]; onNavigate: () => void }) {
  return <NavLinks {...props} pathname={usePathname()} />;
}

function NavLinks({
  groups,
  pathname,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string | null;
  onNavigate: () => void;
}) {
  const isActive = (item: NavItem) =>
    pathname !== null &&
    (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
  return groups.map((group, i) => (
    <div key={group.label ?? i}>
      {group.label && (
        <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {group.label}
        </p>
      )}
      <ul className="space-y-0.5">
        {group.items.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-foreground [&>svg]:text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon name={item.icon} />
                {item.label}
                {item.badge}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  ));
}
