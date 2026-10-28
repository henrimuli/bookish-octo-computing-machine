import { describe, expect, it } from "vitest";
import { normalizeWebsite } from "./website";

const ok = (raw: string) => {
  const r = normalizeWebsite(raw);
  if (!r.ok) throw new Error(`expected ${raw} to be valid: ${r.error}`);
  return r.url;
};

describe("normalizeWebsite", () => {
  it("adds https:// when the scheme is missing", () => {
    expect(ok("acme.io")).toBe("https://acme.io");
    expect(ok("www.acme.io")).toBe("https://www.acme.io");
    expect(ok("  acme.io/pricing  ")).toBe("https://acme.io/pricing");
  });

  it("keeps http and https as typed", () => {
    expect(ok("http://acme.io")).toBe("http://acme.io");
    expect(ok("https://acme.io/app?x=1")).toBe("https://acme.io/app?x=1");
  });

  it("fixes mangled schemes", () => {
    expect(ok("https//acme.io")).toBe("https://acme.io");
    expect(ok("https:/acme.io")).toBe("https://acme.io");
    expect(ok("htps://acme.io")).toBe("https://acme.io");
    expect(ok("http//acme.io")).toBe("http://acme.io");
    expect(ok("//acme.io")).toBe("https://acme.io");
  });

  it("lowercases the host and drops a bare trailing slash and hash", () => {
    expect(ok("HTTPS://Acme.IO/")).toBe("https://acme.io");
    expect(ok("acme.io/#top")).toBe("https://acme.io");
  });

  it("rejects things that aren't websites", () => {
    for (const bad of ["", "acme", "localhost", "acme.", "acme.c0m", "acme .io!", "user:pw@acme.io", "-acme.io"]) {
      expect(normalizeWebsite(bad).ok, bad).toBe(false);
    }
  });
});
