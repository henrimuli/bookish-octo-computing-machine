import { describe, expect, it } from "vitest";
import { suggestCategories } from "./categorize";
import { extractPrefill } from "./prefill";

describe("suggestCategories", () => {
  it("picks the obvious categories from name, tagline and description", () => {
    expect(
      suggestCategories({
        name: "Querybird",
        tagline: "Ask your Postgres questions in plain English",
        description: "An AI assistant that turns questions into SQL queries against your database.",
      }),
    ).toEqual(expect.arrayContaining(["ai", "data"]));

    expect(
      suggestCategories({
        name: "Acme Invoices",
        tagline: "Invoices that chase themselves",
        description: "Send invoices, track payments and automate reminders for late clients.",
      })[0],
    ).toBe("finance");
  });

  it("returns at most three, best first, and only allowed slugs", () => {
    const text = {
      tagline: "AI SEO writing assistant",
      description:
        "Write blog articles with GPT, do keyword research, check backlinks and automate social media posts.",
    };
    const all = suggestCategories(text);
    expect(all.length).toBeLessThanOrEqual(3);
    expect(all).toContain("seo");
    expect(suggestCategories(text, ["writing", "games"])).toEqual(["writing"]);
  });

  it("ignores lone ambiguous words and matches whole words only", () => {
    expect(suggestCategories({ tagline: "The best way to play with your content" })).toEqual([]);
    // "ai" inside other words isn't AI.
    expect(suggestCategories({ tagline: "Maintain your trail of paint" })).toEqual([]);
    expect(suggestCategories({})).toEqual([]);
  });

  it("uses headings and meta keywords, with less weight", () => {
    expect(suggestCategories({ name: "Zed", extra: "Chrome extension · browser extension for tabs" })).toEqual([
      "browser-extensions",
    ]);
  });

  it("comes through prefill", () => {
    const html = `<title>Formcraft | Forms that feel like a conversation</title>
      <meta name="description" content="Build forms without code using a drag and drop editor.">
      <h2>Works with Zapier and your CRM</h2>`;
    expect(extractPrefill(html, "https://formcraft.io/").categories).toContain("no-code");
  });
});
