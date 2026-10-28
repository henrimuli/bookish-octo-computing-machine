"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { safeNext, SignInForm, type SocialProvider } from "@/components/sign-in-form";

export function SignInPanel({ socialProviders }: { socialProviders: SocialProvider[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "/dashboard");
  const error = params.get("error");
  return (
    <>
      {error && (
        <p className="mt-4 rounded-md bg-danger/10 p-3 text-sm text-danger">
          Sign-in didn&apos;t complete. Please try again.
        </p>
      )}
      <SignInForm
        socialProviders={socialProviders}
        next={next}
        onSignedIn={() => {
          router.replace(next);
          router.refresh();
        }}
      />
    </>
  );
}
