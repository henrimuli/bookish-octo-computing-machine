import Link from "next/link";
import { Icon } from "@/components/app-shell/icons";
import { ThemeSwitcher } from "@/components/app-shell/theme-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentUser, isStaff } from "@/lib/auth";

/** Bottom of an app sidebar: area switch, theme, who's signed in (links to their profile), sign out. */
export async function AccountFooter({ area }: { area: "dashboard" | "admin" }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;
  const staff = await isStaff(user);
  return (
    <div className="space-y-1">
      {area === "dashboard" && staff && <FooterLink href="/admin/dashboard" icon="shield" label="Admin" />}
      {area === "admin" && <FooterLink href="/dashboard" icon="overview" label="Maker dashboard" />}
      <FooterLink href="/" icon="external" label="View site" />
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <span className="text-sm text-muted-foreground">Theme</span>
        <ThemeSwitcher />
      </div>
      <div className="mt-1 flex items-center gap-1">
        <Link
          href="/dashboard/profile"
          title="Edit your profile"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-2 hover:bg-muted"
        >
          <Avatar name={user.name || user.email} src={user.image} />
          <div className="min-w-0 flex-1">
            {user.name && <p className="truncate text-sm font-medium">{user.name}</p>}
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </Link>
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
