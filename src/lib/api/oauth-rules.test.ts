import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildRedirect, redirectMatches, validChallenge, validRedirectUri, verifyPkce } from "./oauth-rules";

describe("PKCE", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  it("accepts the matching verifier only", () => {
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    expect(validChallenge(challenge)).toBe(true);
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce(verifier.replace("d", "e"), challenge)).toBe(false);
    expect(verifyPkce("short", createHash("sha256").update("short").digest("base64url"))).toBe(false);
  });
});

describe("redirect URIs", () => {
  it("allows https, loopback http and private-use schemes", () => {
    expect(validRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(validRedirectUri("http://127.0.0.1:33418/callback")).toBe(true);
    expect(validRedirectUri("http://localhost/callback")).toBe(true);
    expect(validRedirectUri("cursor://anysphere.cursor-mcp/oauth/callback")).toBe(true);
  });

  it("refuses remote http, script schemes, fragments and junk", () => {
    expect(validRedirectUri("http://evil.test/cb")).toBe(false);
    expect(validRedirectUri("javascript:alert(1)")).toBe(false);
    expect(validRedirectUri("data:text/html,hi")).toBe(false);
    expect(validRedirectUri("https://x.test/cb#frag")).toBe(false);
    expect(validRedirectUri("not a url")).toBe(false);
  });

  it("matches exactly, but ignores the port on loopback", () => {
    const reg = ["http://127.0.0.1/callback", "https://app.test/cb"];
    expect(redirectMatches(reg, "https://app.test/cb")).toBe(true);
    expect(redirectMatches(reg, "https://app.test/cb2")).toBe(false);
    expect(redirectMatches(reg, "http://127.0.0.1:5123/callback")).toBe(true);
    expect(redirectMatches(reg, "http://127.0.0.1:5123/other")).toBe(false);
    expect(redirectMatches(reg, "http://localhost:5123/callback")).toBe(false);
  });

  it("adds code and state to the client's redirect", () => {
    expect(buildRedirect("https://app.test/cb?x=1", { code: "abc", state: "s t", error: undefined })).toBe(
      "https://app.test/cb?x=1&code=abc&state=s+t",
    );
  });
});
