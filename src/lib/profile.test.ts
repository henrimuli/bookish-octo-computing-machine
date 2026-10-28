import { describe, expect, it } from "vitest";
import { normalizeSocial, parseProfile, socialHandle } from "./profile";

describe("normalizeSocial", () => {
  it.each([
    ["@henri", "https://x.com/henri"],
    ["henri_m", "https://x.com/henri_m"],
    ["x.com/henri", "https://x.com/henri"],
    ["https://twitter.com/henri?s=20", "https://x.com/henri"],
    ["https://www.x.com/@henri/", "https://x.com/henri"],
    ["mobile.twitter.com/henri", "https://x.com/henri"],
  ])("X: %s → %s", (raw, url) => {
    expect(normalizeSocial("x", raw)).toEqual({ ok: true, url });
  });

  it.each([
    ["octocat", "https://github.com/octocat"],
    ["@octo-cat", "https://github.com/octo-cat"],
    ["github.com/octocat/hello-world", "https://github.com/octocat"],
    ["https://www.github.com/octocat", "https://github.com/octocat"],
  ])("GitHub: %s → %s", (raw, url) => {
    expect(normalizeSocial("github", raw)).toEqual({ ok: true, url });
  });

  it("clears the link when blank", () => {
    expect(normalizeSocial("x", "  ")).toEqual({ ok: true, url: null });
  });

  it("rejects other sites and bad usernames", () => {
    expect(normalizeSocial("x", "https://github.com/octocat").ok).toBe(false);
    expect(normalizeSocial("github", "https://x.com/henri").ok).toBe(false);
    expect(normalizeSocial("x", "this_name_is_far_too_long").ok).toBe(false);
    expect(normalizeSocial("github", "-bad").ok).toBe(false);
    expect(normalizeSocial("github", "github.com/").ok).toBe(false);
  });
});

describe("parseProfile", () => {
  const base = { name: "Henri", image: "", bio: "", x: "", github: "" };

  it("stores blanks as null", () => {
    expect(parseProfile(base)).toEqual({
      ok: true,
      profile: { name: "Henri", image: null, bio: null, xUrl: null, githubUrl: null },
    });
  });

  it("flattens the bio to one line and normalizes links", () => {
    const r = parseProfile({ ...base, bio: " Builds tools.\n\nShips weekly. ", x: "@henri", github: "henri" });
    expect(r).toMatchObject({
      ok: true,
      profile: {
        bio: "Builds tools. Ships weekly.",
        xUrl: "https://x.com/henri",
        githubUrl: "https://github.com/henri",
      },
    });
  });

  it("reports the first problem", () => {
    expect(parseProfile({ ...base, name: " " })).toEqual({ ok: false, error: "Add your name." });
    expect(parseProfile({ ...base, bio: "a".repeat(161) }).ok).toBe(false);
    expect(parseProfile({ ...base, image: "http://insecure.example/a.png" }).ok).toBe(false);
    expect(parseProfile({ ...base, x: "facebook.com/henri" }).ok).toBe(false);
  });
});

describe("socialHandle", () => {
  it("reads the username from a stored URL", () => {
    expect(socialHandle("https://x.com/henri")).toBe("henri");
  });
});
