import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ApiTokens } from "@/components/api-tokens";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { env } from "@/env";
import { listTokens } from "@/lib/api/tokens";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "API tokens", robots: { index: false } };

export default function ApiTokensPage() {
  return (
    <Container className="max-w-3xl py-12">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        ← Dashboard
      </Link>
      <Heading className="mt-4">API tokens</Heading>
      <p className="mt-2 text-muted-foreground">
        Tokens let an AI agent or script draft listings and read your stats through our{" "}
        <Link href="/docs" className="text-primary hover:underline">
          MCP server and REST API
        </Link>
        . Agents can only create drafts; you still review, pick a plan and submit here.
      </p>
      <Card className="mt-8 p-6">
        <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
          <Tokens />
        </Suspense>
      </Card>
    </Container>
  );
}

async function Tokens() {
  const user = await requireUser("/dashboard/api");
  const tokens = await listTokens(user.id);
  return <ApiTokens tokens={tokens} mcpUrl={new URL("/api/mcp", env().NEXT_PUBLIC_SITE_URL).toString()} />;
}
