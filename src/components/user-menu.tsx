import { ButtonLink } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentUser } from "@/lib/auth";

export async function UserMenu() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <ButtonLink href="/sign-in" variant="ghost" size="sm">
          Sign in
        </ButtonLink>
        <ButtonLink href="/pricing" size="sm" className="hidden sm:inline-flex">
          Debut your product
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
      <SignOutButton />
    </div>
  );
}
