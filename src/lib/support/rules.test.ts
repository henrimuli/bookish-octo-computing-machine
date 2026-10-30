import { describe, expect, it } from "vitest";
import {
  baseSubject,
  bodyToBlocks,
  displayHtml,
  hasRemoteImages,
  isRichHtml,
  keyFromRefs,
  header,
  newReplyKey,
  parseAddress,
  referencedIds,
  replyAddress,
  replySubject,
  snippetFrom,
  splitQuoted,
  supportKeyFrom,
  threadRef,
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

  it("hides the thread key in a reference and reads it back from ours only", () => {
    const ref = threadRef("abc123", SUPPORT);
    expect(ref).toBe("<thread.abc123@debutyard.com>");
    expect(keyFromRefs(["<x@gmail.test>", ref.toUpperCase()], SUPPORT)).toBe("abc123");
    expect(keyFromRefs(["<thread.abc123@evil.test>", "<abc@debutyard.com>"], SUPPORT)).toBeNull();
  });

  it("splits a reply from the history its mail app quoted, even when the header wraps", () => {
    const gmail =
      "Hi,\n\nI had an issue with an order\n\nOn Fri, Oct 30, 2026 at 5:39 PM DebutYard Support <\nsupport@debutyard.com> wrote:\n\n> This is a test email\n>\n> — Henry, DebutYard";
    expect(splitQuoted(gmail)).toEqual({
      own: "Hi,\n\nI had an issue with an order",
      quoted: expect.stringMatching(/^On Fri[\s\S]*\n> This is a test email/),
    });
    expect(splitQuoted("Thanks!\n\n> earlier line\n> more").own).toBe("Thanks!");
    expect(splitQuoted("No history here.")).toEqual({ own: "No history here.", quoted: "" });
    expect(splitQuoted("Fine\n\n-----Original Message-----\nFrom: x").own).toBe("Fine");
  });

  it("tells designed email from plain writing, ignoring the quoted part", () => {
    expect(isRichHtml('<div dir="ltr">Hi,<div><br></div>Thanks</div>')).toBe(false);
    expect(
      isRichHtml(
        '<div dir="ltr">Thanks</div><div class="gmail_quote"><blockquote><table bgcolor="#fff"></table></blockquote></div>',
      ),
    ).toBe(false);
    expect(isRichHtml('<table role="presentation"><tr><td>Newsletter</td></tr></table>')).toBe(true);
    expect(isRichHtml('<p style="color:#333">Hi</p>')).toBe(true);
    expect(isRichHtml(null)).toBe(false);
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
