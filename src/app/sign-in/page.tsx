import type { Metadata } from "next";
import { SignInForm } from "@/components/sign-in-form";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { enabledSocialProviders } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Container className="flex justify-center py-20">
      <Card className="w-full max-w-sm">
        <Heading className="text-2xl sm:text-2xl">Sign in to DebutYard</Heading>
        <p className="mt-2 text-sm text-muted-foreground">We&apos;ll email you a link. No password needed.</p>
        <SignInForm socialProviders={enabledSocialProviders()} />
      </Card>
    </Container>
  );
}
