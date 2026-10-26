import { describe, expect, it } from "vitest";
import { detectBadge, dnsRecordValue } from "./detect";
import { nextBadgeState } from "./state";
import { badgeSnippet, badgeSvg } from "./svg";

const HOSTS = ["debutyard.com"];
const PAGE = "https://maker.app/";

describe("detectBadge", () => {
  it("finds a followed link to us", () => {
    const html = `<footer><a href="https://debutyard.com/p/maker?ref=badge" target="_blank"><img src="x"></a></footer>`;
    expect(detectBadge(html, PAGE, HOSTS)).toEqual({ ok: true });
  });

  it("accepts www and other paths on our domain", () => {
    expect(detectBadge(`<a href="https://www.debutyard.com/">DY</a>`, PAGE, HOSTS).ok).toBe(true);
  });

  it("rejects nofollow, sponsored and ugc links with a specific reason", () => {
    for (const rel of ["nofollow", "sponsored", "ugc noopener", "noopener NOFOLLOW"]) {
      const res = detectBadge(`<a rel="${rel}" href="https://debutyard.com/p/x">b</a>`, PAGE, HOSTS);
      expect(res).toMatchObject({ ok: false, reason: "nofollow" });
    }
  });

  it("passes when any one badge link is followed", () => {
    const html = `<a rel="nofollow" href="https://debutyard.com/a">1</a><a href="https://debutyard.com/b">2</a>`;
    expect(detectBadge(html, PAGE, HOSTS).ok).toBe(true);
  });

  it("ignores links inside comments and scripts, and lookalike domains", () => {
    const html = `<!-- <a href="https://debutyard.com">x</a> -->
      <script>document.write('<a href="https://debutyard.com">x</a>')</script>
      <a href="https://debutyard.com.evil.io/">x</a><a href="https://notdebutyard.com/">y</a>`;
    expect(detectBadge(html, PAGE, HOSTS)).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("resolves relative links against the page (for our own domain)", () => {
    expect(detectBadge(`<a href="/p/x">x</a>`, "https://debutyard.com/about", HOSTS).ok).toBe(true);
  });

  it("formats the DNS record", () => {
    expect(dnsRecordValue("abc")).toBe("debutyard-verification=abc");
  });
});

describe("nextBadgeState", () => {
  const now = new Date("2026-11-01T00:00:00Z");

  it("verifies from any state when found", () => {
    for (const status of ["unverified", "grace", "missing"] as const) {
      expect(nextBadgeState({ status, graceUntil: null }, true, now)).toMatchObject({
        status: "verified",
        graceUntil: null,
      });
    }
  });

  it("starts a 7-day grace period (and one notification) when a verified badge disappears", () => {
    const res = nextBadgeState({ status: "verified", graceUntil: null }, false, now);
    expect(res.status).toBe("grace");
    expect(res.notifyMissing).toBe(true);
    expect(res.graceUntil?.toISOString()).toBe("2026-11-08T00:00:00.000Z");
  });

  it("stays in grace until it expires, then goes missing without re-notifying", () => {
    const graceUntil = new Date("2026-11-05T00:00:00Z");
    expect(nextBadgeState({ status: "grace", graceUntil }, false, now)).toMatchObject({
      status: "grace",
      notifyMissing: false,
    });
    expect(nextBadgeState({ status: "grace", graceUntil }, false, new Date("2026-11-06T00:00:00Z"))).toMatchObject({
      status: "missing",
      notifyMissing: false,
    });
  });

  it("leaves unverified listings unverified", () => {
    expect(nextBadgeState({ status: "unverified", graceUntil: null }, false, now).status).toBe("unverified");
  });
});

describe("badge artwork", () => {
  it("renders winner and featured variants", () => {
    expect(badgeSvg({ kind: "winner", place: 1, theme: "dark" })).toContain("#1 DEBUT OF THE WEEK");
    expect(badgeSvg({ kind: "featured", theme: "light", votes: 42 })).toContain(">42<");
  });

  it("produces a followed snippet (no rel attribute) pointing at the listing", () => {
    const html = badgeSnippet({ siteUrl: "https://debutyard.com/", slug: "my-app", theme: "light" });
    expect(html).toContain('href="https://debutyard.com/p/my-app?ref=badge"');
    expect(html).not.toContain("rel=");
    // The snippet must pass our own detector.
    expect(detectBadge(html, PAGE, HOSTS).ok).toBe(true);
  });
});
