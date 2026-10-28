import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractPrefill, prefillPages } from "./prefill";
import { composeCopy, fitTo, readPage } from "./site-copy";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");

describe("readPage", () => {
  const facts = readPage(fixture("saas-home.html"), "https://pulseboard.io/");

  it("finds the hero and the line under it", () => {
    expect(facts.hero).toBe("Know when your site goes down, before your customers do");
    expect(facts.subhead).toMatch(/^Pulseboard checks your websites/);
  });

  it("reads feature headings that have a blurb", () => {
    expect(facts.features).toEqual(["Multi-region checks", "Status pages", "Cron job monitoring", "On-call alerts"]);
  });

  it("skips scripts, cookie banners, testimonials and footers", () => {
    const text = facts.sentences.join(" ");
    expect(text).not.toMatch(/cookies|analytics|game changer|All rights reserved/);
  });

  it("reads pricing, audience and links", () => {
    expect(facts.pricing).toMatchObject({ free: true, openSource: false, price: { amount: 19, label: "$19/month" } });
    expect(facts.audience).toBe("engineering teams and developers");
    expect(facts.githubUrl).toBe("https://github.com/pulseboard/agent");
    expect(facts.twitterUrl).toBe("https://x.com/pulseboard");
    expect(facts.ld.description).toMatch(/^Pulseboard monitors websites/);
  });

  it("suggests same-site pages to read next, features first", () => {
    expect(facts.more).toEqual(["https://pulseboard.io/features", "https://pulseboard.io/pricing"]);
    expect(prefillPages(fixture("saas-home.html"), "https://pulseboard.io/", 1)).toEqual([
      "https://pulseboard.io/features",
    ]);
  });

  it("doesn't follow blog, changelog or docs links", () => {
    const p = readPage(
      '<a href="/changelog">Product updates</a><a href="/blog/why-we-built-it">Why we built it</a>' +
        '<a href="/docs/features">Docs</a><a href="/about">About</a>',
      "https://a.io/",
    );
    expect(p.more).toEqual(["https://a.io/about"]);
  });

  it("drops step numbers and changelog headings from features", () => {
    const p = readPage(
      "<main><h3>1. Connect your calendar</h3><p>Link Google or Outlook in a couple of clicks.</p>" +
        "<h3>2. Introducing</h3><p>Our newest release brings faster sync to everyone.</p></main>",
      "https://a.io/",
    );
    expect(p.features).toEqual(["Connect your calendar"]);
  });

  it("doesn't call a product open source for its open-source SDKs", () => {
    const sdks = readPage("<main><p>Open-source SDKs for all platforms.</p></main>", "https://a.io/");
    const product = readPage("<main><p>Acme is free and open source.</p></main>", "https://a.io/");
    expect(sdks.pricing.openSource).toBe(false);
    expect(product.pricing.openSource).toBe(true);
  });

  it("converts yearly prices to monthly and ignores $0", () => {
    const p = readPage("<main><p>Starter $0/month. Team $120 per year billed annually.</p></main>", "https://a.io/");
    expect(p.pricing.price).toEqual({ amount: 10, label: "$10/month" });
  });
});

describe("extractPrefill with site copy", () => {
  it("writes a fuller description from a landing page", () => {
    const p = extractPrefill(fixture("saas-home.html"), "https://pulseboard.io/");
    expect(p.tagline).toBe("Know when your site goes down, before your customers do");
    expect(p.description).toContain(
      "Pulseboard monitors websites, APIs and cron jobs from 12 regions and alerts your team in seconds.",
    );
    // Features, audience and pricing aren't written into the description.
    expect(p.description).not.toMatch(/Features include|Built for|Free plan available|game changer|cookies/);
    expect(p.description!.length).toBeLessThanOrEqual(900);
    expect(p.shortDescription!.length).toBeLessThanOrEqual(160);
    expect(p.pricingModel).toBe("freemium");
    expect(p.githubUrl).toBe("https://github.com/pulseboard/agent");
    expect(p.twitterUrl).toBe("https://x.com/pulseboard");
    expect(p.categories).toContain("devops");
  });

  it("phrases an imperative hero as what the product helps you do", () => {
    const p = extractPrefill(fixture("oss-home.html"), "https://inkwell.dev/");
    expect(p.description).toMatch(/^Inkwell helps you write docs your team will actually read\./);
    expect(p.description).not.toMatch(/Features include/);
    expect(p.description).not.toMatch(/newsletter/);
    expect(p.pricingModel).toBe("open_source");
    expect(p.githubUrl).toBe("https://github.com/inkwell-docs/inkwell");
  });

  it("reads pricing and copy from the extra pages it was given", () => {
    const features = {
      url: "https://inkwell.dev/features",
      html: "<main><p>Inkwell plugins let you extend the build with a few lines of JavaScript.</p></main>",
    };
    const pricing = { url: "https://inkwell.dev/pricing", html: "<main><p>Cloud hosting from $8/month.</p></main>" };
    const home = "<title>Inkwell</title><main><h1>Inkwell</h1><p>Free plan for personal docs.</p></main>";
    const p = extractPrefill(home, "https://inkwell.dev/", [features, pricing]);
    expect(p.description).toContain("Inkwell plugins let you extend the build");
    expect(p.pricingModel).toBe("freemium");
  });

  it("falls back to the meta description on a page with no content", () => {
    const p = extractPrefill(
      `<title>Solo</title><meta name="description" content="Solo keeps one list of the things that matter today.">`,
      "https://solo.app/",
    );
    expect(p.description).toBe("Solo keeps one list of the things that matter today.");
    expect(p.pricingModel).toBeUndefined();
  });
});

describe("composeCopy", () => {
  it("doesn't repeat what the lead already says", () => {
    const page = readPage(
      "<main><h1>The shared notes app for busy product teams</h1><p>Acme is the shared notes app for busy product teams who write together.</p></main>",
      "https://acme.app/",
    );
    const copy = composeCopy("Acme", [page], {});
    expect(copy.description).toBe("Acme is the shared notes app for busy product teams.");
  });
});

describe("fitTo", () => {
  it("cuts at a word boundary and marks the cut", () => {
    expect(fitTo("one two three four", 16)).toBe("one two three…");
    expect(fitTo("short", 12)).toBe("short");
  });
});
