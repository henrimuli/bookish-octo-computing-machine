import { describe, expect, it } from "vitest";
import { isFollowed, listingRel, withRef } from "@/lib/board/links";
import { rank, voteWeight } from "@/lib/board/ranking";
import { domainOf, slugify } from "@/lib/slug";
import { productInput } from "./input";
import { extractPrefill } from "./prefill";

describe("extractPrefill", () => {
  const html = `<html><head>
    <title>Acme Notes - Fast notes for busy teams</title>
    <meta property="og:site_name" content="Acme Notes">
    <meta name="description" content="Acme Notes keeps your team&#39;s notes in sync. Works offline.">
    <meta property="og:image" content="/og.png">
    <meta name="twitter:site" content="@acmenotes">
    <link rel="icon" href="/favicon-32.png"><link rel="apple-touch-icon" href="/apple.png">
  </head></html>`;

  it("pulls name, tagline, description, logo and X handle", () => {
    expect(extractPrefill(html, "https://acme.app/")).toEqual({
      url: "https://acme.app/",
      name: "Acme Notes",
      tagline: "Fast notes for busy teams",
      description: "Acme Notes keeps your team's notes in sync. Works offline.",
      logoUrl: "https://acme.app/apple.png",
      imageUrl: "https://acme.app/og.png",
      twitterUrl: "https://x.com/acmenotes",
      categories: ["productivity"],
    });
  });

  it("falls back to the favicon and the description's first sentence", () => {
    const res = extractPrefill(
      `<title>Solo</title><meta name="description" content="Does one thing. Very well.">`,
      "https://s.io/a",
    );
    expect(res).toMatchObject({ name: "Solo", tagline: "Does one thing.", logoUrl: "https://s.io/favicon.ico" });
  });

  it("ignores javascript: and malformed icon URLs", () => {
    const res = extractPrefill(`<link rel="icon" href="javascript:alert(1)"><title>X</title>`, "https://x.io/");
    expect(res.logoUrl).toBe("https://x.io/favicon.ico");
  });
});

describe("productInput", () => {
  const valid = {
    websiteUrl: "https://acme.app",
    name: "Acme",
    tagline: "Notes for busy teams",
    description: "A".repeat(50),
    logoUrl: "",
    categories: ["productivity"],
    pricingModel: "freemium" as const,
    twitterUrl: "",
    githubUrl: "",
  };

  it("accepts a valid listing and normalises empty optional URLs", () => {
    const parsed = productInput.parse(valid);
    expect(parsed.logoUrl).toBeUndefined();
  });

  it.each([
    [{ websiteUrl: "javascript:alert(1)" }, "websiteUrl"],
    [{ tagline: "short" }, "tagline"],
    [{ categories: [] }, "categories"],
    [{ categories: ["a", "b", "c", "d"] }, "categories"],
    [{ logoUrl: "data:image/png;base64,xx" }, "logoUrl"],
  ])("rejects %o", (override, field) => {
    const res = productInput.safeParse({ ...valid, ...override });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0].path[0]).toBe(field);
  });
});

describe("ranking", () => {
  it("down-weights new accounts and shared IPs", () => {
    expect(voteWeight({ accountAgeHours: 500, sameIpVotesOnProduct: 0 })).toEqual({ weight: 1, flagReason: null });
    expect(voteWeight({ accountAgeHours: 1, sameIpVotesOnProduct: 0 }).weight).toBe(0.25);
    expect(voteWeight({ accountAgeHours: 1, sameIpVotesOnProduct: 5 })).toEqual({
      weight: 0.1,
      flagReason: "new account, shared IP",
    });
  });

  it("orders by score, then votes, then approval time", () => {
    const t = (h: number) => new Date(Date.UTC(2026, 9, 26, h));
    const ranked = rank([
      { id: "a", score: 5, votes: 5, approvedAt: t(2) },
      { id: "b", score: 7, votes: 3, approvedAt: t(3) },
      { id: "c", score: 5, votes: 6, approvedAt: t(4) },
      { id: "d", score: 5, votes: 5, approvedAt: t(1) },
    ]);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["d", 3],
      ["a", 4],
    ]);
  });
});

describe("listing links", () => {
  it("follows paid, winners and verified/grace badges only", () => {
    expect(isFollowed({ tier: "pro", isWinner: false, badgeStatus: "unverified" })).toBe(true);
    expect(isFollowed({ tier: "free", isWinner: true, badgeStatus: "missing" })).toBe(true);
    expect(isFollowed({ tier: "free", isWinner: false, badgeStatus: "grace" })).toBe(true);
    expect(listingRel({ tier: "free", isWinner: false, badgeStatus: "missing" })).toBe("nofollow ugc noopener");
  });

  it("adds ?ref=debutyard without clobbering an existing ref", () => {
    expect(withRef("https://a.io/x?y=1")).toBe("https://a.io/x?y=1&ref=debutyard");
    expect(withRef("https://a.io/?ref=ph")).toBe("https://a.io/?ref=ph");
  });
});

describe("slugs", () => {
  it("slugifies names and normalises domains", () => {
    expect(slugify("Crème Brûlée App!")).toBe("creme-brulee-app");
    expect(slugify("---")).toBe("");
    expect(domainOf("https://WWW.Acme.app/path")).toBe("acme.app");
  });
});
