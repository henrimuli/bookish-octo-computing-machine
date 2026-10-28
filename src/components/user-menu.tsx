import { DebutLink } from "@/components/debut/debut-link";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser, isStaff } from "@/lib/auth";

export async function UserMenu() {
  const user = await getCurrentUser().catch(() => null);
  const debut = (
    <DebutLink size="sm" className="hidden sm:inline-flex">
      Debut your product
    </DebutLink>
  );
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <ButtonLink href="/sign-in" variant="ghost" size="sm">
          Sign in
        </ButtonLink>
        {debut}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      {(await isStaff(user)) && (
        <ButtonLink href="/admin/dashboard" variant="ghost" size="sm">
          Admin
        </ButtonLink>
      )}
      <ButtonLink href="/dashboard" variant="ghost" size="sm">
        Dashboard
      </ButtonLink>
      {debut}
    </div>
  );
}
