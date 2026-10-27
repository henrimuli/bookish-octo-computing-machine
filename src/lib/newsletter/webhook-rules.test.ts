import { describe, expect, it } from "vitest";
import { parseEvent, signSvix, verifySvix } from "./webhook-rules";

const secret = `whsec_${Buffer.from("test-secret-key-0123456789").toString("base64")}`;

describe("Svix signatures", () => {
  const body = '{"type":"email.opened"}';
  const ts = "1761562800";
  const now = Number(ts) * 1000;
  const headers = (signature: string | null, timestamp = ts) => ({ id: "msg_1", timestamp, signature });

  it("accepts a valid signature among several", () => {
    const sig = signSvix("msg_1", ts, body, secret);
    expect(verifySvix(headers(sig), body, secret, now)).toBe(true);
    expect(verifySvix(headers(`v1,AAAA ${sig}`), body, secret, now)).toBe(true);
  });

  it("refuses tampered bodies, stale timestamps and missing headers", () => {
    const sig = signSvix("msg_1", ts, body, secret);
    expect(verifySvix(headers(sig), body + " ", secret, now)).toBe(false);
    expect(verifySvix(headers(sig), body, secret, now + 10 * 60_000)).toBe(false);
    expect(verifySvix(headers(null), body, secret, now)).toBe(false);
  });
});

describe("parseEvent", () => {
  it("reads opens and clicks on tagged issues", () => {
    expect(
      parseEvent({
        type: "email.clicked",
        created_at: "2026-10-27T10:00:00.000Z",
        data: { to: ["Ada@X.test"], tags: { issue: "2026-W43" }, click: { link: "https://debutyard.com/p/acme" } },
      }),
    ).toEqual({
      type: "clicked",
      weekKey: "2026-W43",
      email: "ada@x.test",
      link: "https://debutyard.com/p/acme",
      at: new Date("2026-10-27T10:00:00.000Z"),
    });
    expect(
      parseEvent({ type: "email.opened", data: { to: "b@x.test", tags: [{ name: "issue", value: "2026-W43" }] } }),
    ).toMatchObject({ type: "opened", weekKey: "2026-W43", email: "b@x.test" });
  });

  it("ignores other events and untagged mail", () => {
    expect(parseEvent({ type: "email.bounced", data: { to: ["a@x.test"], tags: { issue: "2026-W43" } } })).toBeNull();
    expect(parseEvent({ type: "email.opened", data: { to: ["a@x.test"] } })).toBeNull();
    expect(parseEvent(null)).toBeNull();
  });
});
