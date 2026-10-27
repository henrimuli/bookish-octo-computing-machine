import { describe, expect, it } from "vitest";
import { explainLink, toDomain } from "./explain";

describe("free tools", () => {
  it("normalizes domains from URLs or bare hosts", () => {
    expect(toDomain("https://www.Acme.io/pricing?x=1")).toBe("acme.io");
    expect(toDomain(" acme.io ")).toBe("acme.io");
    expect(() => toDomain("localhost")).toThrow();
    expect(() => toDomain("http://")).toThrow();
  });

  it("explains each verdict", () => {
    expect(explainLink({ verdict: "dofollow", rel: null, httpStatus: 200 }, "acme.io")).toContain("followed");
    expect(explainLink({ verdict: "nofollow", rel: "noopener ugc", httpStatus: 200 }, "acme.io")).toContain(
      'rel="ugc"',
    );
    expect(explainLink({ verdict: "unreachable", rel: null, httpStatus: 404 }, "acme.io")).toContain("404");
  });
});
