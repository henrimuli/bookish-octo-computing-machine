import { renderEmail, type Block, type EmailItem } from "@/lib/email-template";

/** Pure renderer for the weekly digest. Data in, subject/html/text out. */

export type DigestProduct = {
  name: string;
  tagline: string;
  url: string;
  logoUrl: string | null;
  applause?: number;
  place?: number;
};

export type DigestData = {
  closedWeekLabel: string;
  newWeekLabel: string;
  winners: DigestProduct[];
  topOfWeek: DigestProduct[];
  debutingNow: Array<DigestProduct & { featured: boolean }>;
  sponsor: { bookingId: string; name: string; tagline: string; url: string; logoUrl: string | null } | null;
  /** Spotlight's top newsletter slot: a boxed row above everything else. `tagline` is the blurb. */
  spotlight?: DigestProduct[];
  /** Pro and Premium debuts' newsletter mentions. `tagline` is the blurb. */
  featuredDebuts?: DigestProduct[];
  /** The perk tasks these mentions deliver, marked done once the issue is sent. */
  perkTaskIds?: string[];
  siteUrl: string;
};

export function digestSubject(d: DigestData): string {
  const top = d.winners[0];
  return top ? `${top.name} wins ${d.closedWeekLabel}, plus this week's debuts` : `This week's debuts on DebutYard`;
}

/** A product row with its logo tile (or initial) beside the name and tagline. */
const item = (p: DigestProduct, extra: Partial<EmailItem> = {}): EmailItem => ({
  name: p.name,
  detail: p.tagline,
  href: p.url,
  logo: p.logoUrl,
  aside: typeof p.applause === "number" ? `👏 ${p.applause}` : undefined,
  ...extra,
});

export function renderDigest(d: DigestData, unsubscribeUrl: string): { subject: string; html: string; text: string } {
  const blocks: Block[] = [{ heading: "Your weekly look at what just launched" }];
  if (d.spotlight?.length) {
    blocks.push({ box: "Spotlight", items: d.spotlight.map((p) => item(p)) });
  }
  if (d.winners.length) {
    blocks.push(
      { section: `Debut of the Week · ${d.closedWeekLabel}` },
      { items: d.winners.map((p) => item(p, { medal: p.place })) },
    );
  }
  if (d.sponsor) {
    blocks.push({
      box: "Sponsor",
      items: [{ name: d.sponsor.name, detail: d.sponsor.tagline, href: d.sponsor.url, logo: d.sponsor.logoUrl }],
    });
  }
  if (d.featuredDebuts?.length) {
    blocks.push({ section: "Featured debuts" }, { items: d.featuredDebuts.map((p) => item(p)) });
  }
  if (d.debutingNow.length) {
    blocks.push(
      { section: `Debuting now · ${d.newWeekLabel}` },
      {
        items: d.debutingNow.map((p) => item(p, p.featured ? { chip: { label: "Featured", tone: "good" } } : {})),
      },
    );
  }
  if (d.topOfWeek.length) {
    blocks.push({ section: "Also loved last week" }, { items: d.topOfWeek.map((p) => item(p)) });
  }
  blocks.push({ button: "Applaud this week's debuts", href: d.siteUrl });

  const top = d.winners[0];
  return renderEmail({
    variant: "newsletter",
    label: "Weekly digest",
    subject: digestSubject(d),
    preheader: top
      ? `${top.name} took Debut of the Week. Here's what debuts next.`
      : "Your weekly look at what just launched.",
    reason: "you subscribed to the DebutYard weekly digest",
    unsubscribeUrl,
    blocks,
  });
}
