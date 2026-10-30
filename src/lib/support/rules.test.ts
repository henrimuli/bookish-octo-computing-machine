import { describe, expect, it } from "vitest";
import {
  baseSubject,
  bodyToBlocks,
  displayHtml,
  hasRemoteImages,
  header,
  newReplyKey,
  parseAddress,
  referencedIds,
  replyAddress,
  replySubject,
  snippetFrom,
  supportKeyFrom,
} from "./rules";

const SUPPORT = "support@debutyard.com";

describe("support inbox rules", () => {
  it("recognises support@ and its per-thread reply addresses, on our domain only", () => {
    expect(supportKeyFrom("support@debutyard.com", SUPPORT)).toBe("");
    expect(supportKeyFrom("DebutYard <Support@DebutYard.com>", SUPPORT)).toBe("");
    const key = newReplyKey();
    expect(key).toMatch(/^[a-z0-9]{12}$/);
    expect(supportKeyFrom(replyAddress(key, SUPPORT), SUPPORT)).toBe(key);
    expect(supportKeyFrom("support@evil.com", SUPPORT)).toBeNull();
    expect(supportKeyFrom("hello@debutyard.com", SUPPORT)).toBeNull();
    expect(supportKeyFrom("k3y@submit.debutyard.com", SUPPORT)).toBeNull();
  });

  it("parses addresses with and without names", () => {
    expect(parseAddress('"Ada Okafor" <Ada@X.io>')).toEqual({ name: "Ada Okafor", email: "ada@x.io" });
    expect(parseAddress("ada@x.io")).toEqual({ name: null, email: "ada@x.io" });
  });

  it("normalises reply subjects", () => {
    expect(baseSubject("Re: RE: Fwd: Billing question")).toBe("Billing question");
    expect(baseSubject("Billing question")).toBe("Billing question");
    expect(replySubject("Billing question")).toBe("Re: Billing question");
    expect(replySubject("Re: Billing question")).toBe("Re: Billing question");
  });

  it("reads referenced message ids, newest first, and headers in any case", () => {
    expect(referencedIds("<c@x>", "<a@x> <b@x>\n <c@x>")).toEqual(["<c@x>", "<b@x>", "<a@x>"]);
    expect(referencedIds(null, null)).toEqual([]);
    expect(header({ "In-Reply-To": "<a@x>" }, "in-reply-to")).toBe("<a@x>");
    expect(header(null, "references")).toBeNull();
  });

  it("makes list snippets without the quoted history", () => {
    const text = "Thanks, that fixed it!\n\nOn Wed, 28 Oct 2026 at 10:00, DebutYard wrote:\n> Try clearing your cache.";
    expect(snippetFrom(text)).toBe("Thanks, that fixed it!");
    expect(snippetFrom("a ".repeat(200), 20)).toHaveLength(20);
  });

  it("turns typed text into paragraphs, bullets and links", () => {
    expect(bodyToBlocks("Hi Ada,\n\nTwo things:\n\n- one\n- two\n\nSee [your listing](https://x.test).\r\n")).toEqual([
      { text: "Hi Ada," },
      { text: "Two things:" },
      { bullets: ["one", "two"] },
      { text: "See [your listing](https://x.test)." },
    ]);
    expect(bodyToBlocks("  \n\n ")).toEqual([]);
  });

  it("blocks remote images until asked", () => {
    const html = '<p>Hi</p><img src="https://track.test/p.gif">';
    expect(hasRemoteImages(html)).toBe(true);
    expect(hasRemoteImages('<img src="data:image/png;base64,AA">')).toBe(false);
    expect(displayHtml(html, false)).toContain("img-src data:;");
    expect(displayHtml(html, true)).toContain("img-src * data:");
    expect(displayHtml(html, false)).toContain('<base target="_blank">');
  });
});
