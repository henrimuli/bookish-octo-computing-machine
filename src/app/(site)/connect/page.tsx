import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { checkAuthorize } from "@/lib/api/oauth";
import { buildRedirect } from "@/lib/api/oauth-rules";
import { requireUser } from "@/lib/auth";
import { approveConnect, denyConnect } from "./actions";

export const metadata: Metadata = { title: "Connect an app", robots: { index: false } };

const FIELDS = ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state"];

/** OAuth authorization endpoint: an MCP client sends people here to approve access. */
export default function ConnectPage(props: PageProps<"/connect">) {
  return (
    <Container className="flex justify-center py-20">
      <Card className="w-full max-w-md">
        <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
          <Consent searchParams={props.searchParams} />
        </Suspense>
      </Card>
    </Container>
  );
}

async function Consent({ searchParams }: { searchParams: PageProps<"/connect">["searchParams"] }) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    FIELDS.flatMap((k) => {
      const v = Array.isArray(raw[k]) ? raw[k][0] : raw[k];
      return v === undefined ? [] : [[k, v]];
    }),
  ) as Record<string, string>;
  const user = await requireUser(`/connect?${new URLSearchParams(params)}`);

  const checked = await checkAuthorize({
    clientId: params.client_id ?? "",
    redirectUri: params.redirect_uri ?? "",
    responseType: params.response_type ?? "",
    codeChallenge: params.code_challenge ?? "",
    codeChallengeMethod: params.code_challenge_method ?? "",
  });
  if ("fatal" in checked) {
    return (
      <>
        <Heading className="text-2xl sm:text-2xl">Can&apos;t connect</Heading>
        <p className="mt-2 text-sm text-muted-foreground">{checked.fatal}</p>
      </>
    );
  }
  if (checked.error) redirect(buildRedirect(params.redirect_uri, { error: checked.error, state: params.state }));

  const hidden = Object.entries(params).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  return (
    <>
      <Heading className="text-2xl sm:text-2xl">Connect {checked.client.name}?</Heading>
      <p className="mt-3 text-sm text-muted-foreground">
        <strong className="text-foreground">{checked.client.name}</strong> wants to use DebutYard as{" "}
        <strong className="text-foreground">{user.email}</strong>. It will be able to:
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Draft listings for you (you still review and submit them here)</li>
        <li>Read your launches, stats and tracked links</li>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        It can&apos;t pay, submit or publish anything. You can disconnect it any time from Dashboard → API tokens.
      </p>
      <p className="mt-3 break-all text-xs text-muted-foreground">
        You&apos;ll be sent back to{" "}
        {new URL(params.redirect_uri).origin === "null" ? params.redirect_uri : new URL(params.redirect_uri).origin}.
      </p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <form action={denyConnect}>
          {hidden}
          <Button type="submit" variant="outline" className="w-full sm:w-auto">
            Cancel
          </Button>
        </form>
        <form action={approveConnect}>
          {hidden}
          <Button type="submit" className="w-full sm:w-auto">
            Allow
          </Button>
        </form>
      </div>
    </>
  );
}
