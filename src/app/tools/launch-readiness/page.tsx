import type { Metadata } from "next";
import { ReadinessTool } from "@/components/readiness-tool";
import { Card, Container, Heading } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Launch readiness check",
  description:
    "Free check before you launch: HTTPS, page title and description, social image, indexability, duplicates and badge, with a score and fixes.",
  alternates: { canonical: "/tools/launch-readiness" },
};

export default function ReadinessPage() {
  return (
    <Container className="max-w-3xl py-12">
      <Heading>Is your product ready to launch?</Heading>
      <p className="mt-3 text-muted-foreground">
        Paste your URL. We check what launch directories and reviewers look at, score it, and tell you what to fix.
        Free, no account needed.
      </p>
      <div className="mt-8">
        <ReadinessTool />
      </div>
      <Card className="mt-12 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Using an AI agent?</p>
        <p className="mt-1">
          The same check is available as <code>check_launch_readiness</code> on our MCP server and at{" "}
          <code>POST /api/v1/readiness</code>. See the{" "}
          <a href="/docs" className="text-primary hover:underline">
            API docs
          </a>
          .
        </p>
      </Card>
    </Container>
  );
}
