import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, Container } from "@/components/ui/primitives";

const pillars = [
  {
    title: "Weekly debuts",
    body: "Every Monday a new class of products debuts. Seven days of votes, not a 24-hour scramble. The top three become Debut of the Week.",
  },
  {
    title: "Honest ranking",
    body: "Paid plans buy placement, never votes. No vote multipliers, no head starts, and fraud filtering you can read about.",
  },
  {
    title: "Listed everywhere, with proof",
    body: "We submit your product to the directories that matter, then verify every link: live, dofollow and indexed, and we keep checking.",
  },
];

export default function Home() {
  return (
    <>
      <section className="border-b border-border">
        <Container className="py-20 sm:py-28">
          <Badge tone="primary">Opening soon</Badge>
          <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-6xl">
            Where great products <span className="text-primary">debut</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Launch to a community of builders every week, get listed on the directories that matter, and see proof of
            every link you earn.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/pricing" size="lg">
              Debut your product
            </ButtonLink>
            <ButtonLink href="/pricing#submissions" size="lg" variant="outline">
              Get listed on 40+ directories
            </ButtonLink>
          </div>
        </Container>
      </section>

      <Container className="grid gap-6 py-16 sm:grid-cols-3">
        {pillars.map((p) => (
          <Card key={p.title}>
            <h2 className="font-display text-lg font-semibold">{p.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
          </Card>
        ))}
      </Container>
    </>
  );
}
