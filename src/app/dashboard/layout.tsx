import { Suspense } from "react";
import { AccountFooter } from "@/components/app-shell/account-footer";
import { AppShell, type NavGroup } from "@/components/app-shell/app-shell";
import { Icon } from "@/components/app-shell/icons";
import { ButtonLink } from "@/components/ui/button";

const groups: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Overview", icon: "overview", exact: true },
      { href: "/dashboard/products", label: "Products", icon: "products" },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/dashboard/tracker", label: "Directory tracker", icon: "tracker" },
      { href: "/dashboard/links", label: "Link Monitor", icon: "links" },
      { href: "/dashboard/orders", label: "Submission orders", icon: "orders" },
      { href: "/dashboard/sponsorships", label: "Sponsorships", icon: "megaphone" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/billing", label: "Billing & plans", icon: "card" },
      // Affiliates are paused (see src/lib/affiliates/PAUSED.md).
      // { href: "/dashboard/affiliate", label: "Affiliate", icon: "gift" },
      { href: "/dashboard/api", label: "API & agents", icon: "code" },
    ],
  },
];

/** The maker dashboard: its own space with a sidebar, no site header or footer. */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <AppShell
      area="Dashboard"
      groups={groups}
      actions={
        <ButtonLink href="/dashboard/products/new" className="w-full">
          <Icon name="plus" />
          Debut a product
        </ButtonLink>
      }
      footer={
        <Suspense fallback={<div className="h-12 animate-pulse rounded-md bg-muted" />}>
          <AccountFooter area="dashboard" />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
