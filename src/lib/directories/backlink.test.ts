import { describe, expect, it } from "vitest";
import { inspectBacklink } from "./backlink";

const page = (links: string) => `<html><body><nav><a href="/">Home</a></nav>${links}</body></html>`;

describe("inspectBacklink", () => {
  it("finds a followed link and its anchor text", () => {
    expect(
      inspectBacklink(
        page(`<a href="https://www.acme.io/?ref=dir">Visit <b>Acme</b></a>`),
        "https://dir.com/p/acme",
        "acme.io",
      ),
    ).toEqual({ verdict: "dofollow", rel: null, anchor: "Visit Acme", href: "https://www.acme.io/?ref=dir" });
  });

  it("reports nofollow, ugc and sponsored links", () => {
    const r = inspectBacklink(
      page(`<a rel="nofollow noopener" href="https://acme.io">Acme</a>`),
      "https://dir.com/x",
      "acme.io",
    );
    expect(r).toMatchObject({ verdict: "nofollow", rel: "nofollow noopener" });
    expect(
      inspectBacklink(page(`<a rel="sponsored" href="https://acme.io">A</a>`), "https://d.com", "acme.io").verdict,
    ).toBe("nofollow");
  });

  it("prefers a followed link when there are both, and accepts subdomains", () => {
    const html = page(`<a rel="ugc" href="https://acme.io">A</a><a href="https://app.acme.io/signup">Try it</a>`);
    expect(inspectBacklink(html, "https://d.com", "acme.io")).toMatchObject({ verdict: "dofollow", anchor: "Try it" });
  });

  it("uses image alt text as the anchor, and ignores lookalike domains", () => {
    expect(
      inspectBacklink(
        page(`<a href="https://acme.io"><img src="l.png" alt="Acme logo"></a>`),
        "https://d.com",
        "acme.io",
      ).anchor,
    ).toBe("Acme logo");
    expect(
      inspectBacklink(
        page(`<a href="https://notacme.io">x</a><a href="https://acme.io.evil.com">y</a>`),
        "https://d.com",
        "acme.io",
      ).verdict,
    ).toBe("missing");
  });
});
