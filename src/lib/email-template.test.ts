import { describe, expect, it } from "vitest";
import { renderEmail } from "./email-template";
import { renderDigest } from "./newsletter/render";

describe("renderEmail", () => {
  const base = {
    variant: "customer" as const,
    label: "Your listing",
    subject: "Kaptn is approved",
    reason: "you listed Kaptn on DebutYard",
  };

  it("escapes every string, including names in items, facts and headings", () => {
    const evil = `<a href="https://evil.test">x</a>`;
    const { html } = renderEmail({
      ...base,
      blocks: [
        { heading: evil },
        { facts: [["Name", evil]] },
        { items: [{ name: evil, detail: evil }] },
        { code: evil },
      ],
    });
    expect(html).not.toContain('<a href="https://evil.test">');
    expect(html).toContain("&lt;a href=&quot;https://evil.test&quot;&gt;");
  });

  it("turns [label](url) into a link in HTML and 'label (url)' in text", () => {
    const { html, text } = renderEmail({
      ...base,
      blocks: [{ text: "See your [dashboard](https://debutyard.com/dashboard)." }],
    });
    expect(html).toMatch(/<a href="https:\/\/debutyard\.com\/dashboard"[^>]*>dashboard<\/a>/);
    expect(text).toContain("See your dashboard (https://debutyard.com/dashboard).");
  });

  it("gives customers the branded header, button, sign-off and full footer", () => {
    const { html, text } = renderEmail({
      ...base,
      blocks: [{ heading: "Live" }, { button: "View your listing", href: "https://debutyard.com/p/kaptn" }],
    });
    expect(html).toContain("/email/logo-mark.png");
    expect(html).toContain("Your listing");
    expect(html).toContain('href="https://debutyard.com/p/kaptn"');
    expect(html).toContain("— The DebutYard team");
    for (const path of ["/dashboard", "/submission-service", "/advertise", "/terms", "/privacy"]) {
      expect(html).toContain(`${path}"`);
    }
    expect(html).toContain("support@debutyard.com");
    expect(html).toContain("Nairobi");
    expect(html).not.toContain("Unsubscribe");
    expect(text).toContain("View your listing: https://debutyard.com/p/kaptn");
    expect(text).toContain("You're getting this because you listed Kaptn on DebutYard.");
  });

  it("marks staff email and leaves out the customer footer", () => {
    const { html, text } = renderEmail({
      variant: "staff",
      label: "Orders",
      subject: "New order",
      trigger: "Sent by the submission service.",
      blocks: [{ heading: "New order" }],
    });
    expect(html).toContain("STAFF");
    expect(html).toContain("/admin/review");
    expect(html).not.toContain("The DebutYard team");
    expect(html).not.toContain("/terms");
    expect(text).toContain("Sent by the submission service.");
  });

  it("uses the first paragraph as the inbox preview unless one is given", () => {
    const { html } = renderEmail({ ...base, blocks: [{ heading: "H" }, { text: "First line here." }] });
    expect(html).toMatch(/display:none[^>]*>First line here\./);
  });
});

describe("renderEmail for hand-written support mail", () => {
  const e = renderEmail({
    variant: "customer",
    label: "Support",
    subject: "Re: Billing <question>",
    signOff: "— Henry, DebutYard",
    blocks: [
      { text: "Sorted, the refund is on its way." },
      { cite: "On 28 Oct 2026, Ada <ada@x.test> wrote:", quote: "Can I get a refund?\nThanks <3" },
    ],
  });

  it("signs with the staff member's name instead of the team", () => {
    expect(e.html).toContain("— Henry, DebutYard");
    expect(e.html).not.toContain("The DebutYard team");
    expect(e.text).toContain("— Henry, DebutYard");
  });

  it("puts the quoted message after the sign-off, escaped, and quotes it in text", () => {
    expect(e.html.indexOf("— Henry, DebutYard")).toBeLessThan(e.html.indexOf("Can I get a refund?"));
    expect(e.html).toContain("Thanks &lt;3");
    expect(e.html).toContain("Ada &lt;ada@x.test&gt; wrote:");
    expect(e.text.indexOf("— Henry, DebutYard")).toBeLessThan(e.text.indexOf("> Can I get a refund?"));
    expect(e.text).toContain("> Can I get a refund?\n> Thanks <3");
  });
});

describe("renderDigest", () => {
  const product = (name: string, logoUrl: string | null) => ({
    name,
    tagline: `${name} tagline`,
    url: `https://debutyard.com/p/${name.toLowerCase()}`,
    logoUrl,
  });
  const data = {
    closedWeekLabel: "Week 43",
    newWeekLabel: "Week 44",
    winners: [{ ...product("Kaptn", "https://kaptn.app/logo.png"), applause: 9, place: 1 }],
    topOfWeek: [],
    debutingNow: [
      { ...product("Pagepulse", null), featured: true },
      { ...product("Vecto", "https://vecto.io/logo.svg"), featured: false },
    ],
    sponsor: null,
    siteUrl: "https://debutyard.com/",
  };

  it("shows product logos, with an initial tile when there's none or it's an SVG", () => {
    const { html } = renderDigest(data, "https://debutyard.com/newsletter/unsubscribe?token=t");
    expect(html).toContain('src="https://kaptn.app/logo.png"');
    expect(html).not.toContain("logo.svg");
    expect(html).toMatch(/>P<\/div>/);
    expect(html).toMatch(/>V<\/div>/);
  });

  it("highlights the sponsor in a labelled box, keeping its logo tile, name and tagline", () => {
    const { html, text } = renderDigest(
      {
        ...data,
        sponsor: {
          bookingId: "b",
          name: "Formcrate",
          tagline: "Forms to Notion",
          url: "https://debutyard.com/api/ads/b/click",
          logoUrl: "https://formcrate.io/logo.png",
        },
      },
      "",
    );
    const box = html.slice(html.indexOf(">Sponsor<") - 400, html.indexOf("Forms to Notion"));
    expect(box).toContain("border-radius:12px");
    expect(box).toContain('src="https://formcrate.io/logo.png"');
    expect(box).toContain("Formcrate");
    expect(text).toContain("SPONSOR\n- Formcrate: Forms to Notion");
  });

  it("carries the unsubscribe link in both bodies", () => {
    const unsub = "https://debutyard.com/newsletter/unsubscribe?token=t";
    const { html, text } = renderDigest(data, unsub);
    expect(html).toContain("Unsubscribe");
    expect(html).toContain(unsub);
    expect(text).toContain(`Unsubscribe: ${unsub}`);
  });
});
