import type { Metadata } from "next";
import { DofollowChecker } from "@/components/tools/free-tools";
import { Card, Container, Heading } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Dofollow link checker",
  description:
    "Free backlink checker: paste a page and your site to see whether the link is there and whether it's dofollow, nofollow, ugc or sponsored.",
  alternates: { canonical: "/tools/dofollow-checker" },
};

export default function DofollowCheckerPage() {
  return (
    <Container className="max-w-3xl py-12">
      <Heading>Is that backlink dofollow?</Heading>
      <p className="mt-3 text-muted-foreground">
        Paste the page that should link to you (a directory listing, a review, a guest post) and your site. We load the
        page like a crawler does and tell you whether the link is there and whether it&apos;s followed. Free, no account
        needed.
      </p>
      <div className="mt-8">
        <DofollowChecker />
      </div>
      <Card className="mt-12 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Using an AI agent?</p>
        <p className="mt-1">
          The same check is <code>check_dofollow</code> on our MCP server and <code>POST /api/v1/tools/dofollow</code>.
          See the{" "}
          <a href="/docs" className="text-primary hover:underline">
            API docs
          </a>
          .
        </p>
      </Card>
    </Container>
  );
}
