import { describe, expect, it } from "vitest";
import { inboxKeyFrom, messageLinks, newInboxKey, receivedEvent } from "./inbox-rules";

describe("submission inboxes", () => {
  it("makes keys and reads them back from addresses on our domain only", () => {
    const k = newInboxKey();
    expect(k).toMatch(/^[a-z0-9]{10}$/);
    expect(inboxKeyFrom(`Acme Ops <${k}@Submit.Debutyard.com>`, "submit.debutyard.com")).toBe(k);
    expect(inboxKeyFrom(`${k}+g2@submit.debutyard.com`, "submit.debutyard.com")).toBe(k);
    expect(inboxKeyFrom(`${k}@evil.com`, "submit.debutyard.com")).toBeNull();
    expect(inboxKeyFrom("x@submit.debutyard.com", "submit.debutyard.com")).toBeNull();
  });

  it("reads Resend received-email events, envelope recipients first", () => {
    expect(
      receivedEvent({
        type: "email.received",
        data: { email_id: "e1", to: ["a@x.test", "k@y.test"], received_for: ["k@y.test", "b@x.test"] },
      }),
    ).toEqual({ emailId: "e1", recipients: ["k@y.test", "b@x.test", "a@x.test"] });
    expect(receivedEvent({ type: "email.opened", data: { email_id: "e1" } })).toBeNull();
    expect(receivedEvent({ type: "email.received", data: {} })).toBeNull();
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
