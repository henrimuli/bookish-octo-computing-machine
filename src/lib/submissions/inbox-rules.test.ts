import { describe, expect, it } from "vitest";
import { inboxKeyFrom, messageLinks, newInboxKey, signInbound, verifyInbound } from "./inbox-rules";

describe("submission inboxes", () => {
  it("makes keys and reads them back from addresses on our domain only", () => {
    const k = newInboxKey();
    expect(k).toMatch(/^[a-z0-9]{10}$/);
    expect(inboxKeyFrom(`Acme Ops <${k}@Submit.Debutyard.com>`, "submit.debutyard.com")).toBe(k);
    expect(inboxKeyFrom(`${k}+g2@submit.debutyard.com`, "submit.debutyard.com")).toBe(k);
    expect(inboxKeyFrom(`${k}@evil.com`, "submit.debutyard.com")).toBeNull();
    expect(inboxKeyFrom("x@submit.debutyard.com", "submit.debutyard.com")).toBeNull();
  });

  it("accepts only fresh, correctly signed posts", () => {
    const now = Date.UTC(2026, 9, 26, 12);
    const ts = String(Math.floor(now / 1000));
    const sig = signInbound('{"a":1}', ts, "s3cret");
    expect(verifyInbound('{"a":1}', ts, sig, "s3cret", now)).toBe(true);
    expect(verifyInbound('{"a":1}', ts, `sha256=${sig}`, "s3cret", now)).toBe(true);
    expect(verifyInbound('{"a":2}', ts, sig, "s3cret", now)).toBe(false);
    expect(verifyInbound('{"a":1}', ts, sig, "other", now)).toBe(false);
    expect(verifyInbound('{"a":1}', ts, sig, "s3cret", now + 10 * 60_000)).toBe(false);
    expect(verifyInbound('{"a":1}', null, sig, "s3cret", now)).toBe(false);
    expect(verifyInbound('{"a":1}', ts, "zz", "s3cret", now)).toBe(false);
  });

  it("pulls out links, verification ones first", () => {
    const links = messageLinks(
      "Welcome! Visit https://dir.test/home. Confirm: https://dir.test/verify?t=abc.",
      '<a href="https://dir.test/activate?code=1&amp;u=2">Activate</a><a href="https://dir.test/unsubscribe">x</a>',
    );
    expect(links[0]).toEqual({ url: "https://dir.test/verify?t=abc", likely: true });
    expect(links.map((l) => l.url)).toContain("https://dir.test/activate?code=1&u=2");
    expect(links.map((l) => l.url)).toContain("https://dir.test/home");
    expect(links.some((l) => l.url.includes("unsubscribe"))).toBe(false);
  });
});
