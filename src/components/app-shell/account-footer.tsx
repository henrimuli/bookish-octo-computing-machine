import Link from "next/link";
import { Icon } from "@/components/app-shell/icons";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentUser, isStaff } from "@/lib/auth";

/** Bottom of an app sidebar: who's signed in, a switch between maker and admin areas, sign out. */
export async function AccountFooter({ area }: { area: "dashboard" | "admin" }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;
  const staff = await isStaff(user);
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();
  return (
    <div className="space-y-1">
      {area === "dashboard" && staff && <FooterLink href="/admin/dashboard" icon="shield" label="Admin" />}
      {area === "admin" && <FooterLink href="/dashboard" icon="overview" label="Maker dashboard" />}
      <FooterLink href="/" icon="external" label="View site" />
      <div className="mt-2 flex items-center gap-2.5 rounded-md px-2 py-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          {user.name && <p className="truncate text-sm font-medium">{user.name}</p>}
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <SignOutButton compact />
      </div>
    </div>
  );
}

function FooterLink({ href, icon, label }: { href: string; icon: "shield" | "overview" | "external"; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Icon name={icon} />
      {label}
    </Link>
  );
}
