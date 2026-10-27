import { Suspense } from "react";
import { SwitchAccountButton } from "@/components/admin/switch-account";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";

/** Shown (403) when a signed-in account without admin access opens an admin page. */
export default function AdminForbidden() {
  return (
    <Container className="flex justify-center py-20">
      <Card className="w-full max-w-md">
        <Heading className="text-2xl sm:text-2xl">Admins only</Heading>
        <p className="mt-2 text-sm text-muted-foreground">
          This part of DebutYard is for the team that runs it. If you should have access, ask an admin to add your
          email.
        </p>
        <Suspense fallback={<p className="mt-4 text-sm text-muted-foreground">Checking your account…</p>}>
          <SignedInAs />
        </Suspense>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <ButtonLink href="/">Back to DebutYard</ButtonLink>
          <SwitchAccountButton />
        </div>
      </Card>
    </Container>
  );
}

async function SignedInAs() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;
  return (
    <p className="mt-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
      Signed in as <strong className="break-all">{user.email}</strong>
    </p>
  );
}
