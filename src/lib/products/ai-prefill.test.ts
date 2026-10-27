import { afterEach, describe, expect, it, vi } from "vitest";

describe("AI prefill", async () => {
  const ai = await import("./ai-prefill");
  const base = {
    url: "https://acme.io/",
    name: "Acme",
    tagline: "Acme – home",
    description: "Meta description",
    categories: [],
  };
  const html = `<html><head><style>.x{}</style><script>var a=1</script></head><body>
    <h1>Acme chases late invoices</h1><p>Acme connects to your invoicing tool and sends polite reminders &amp; follow-ups.</p>
    <p>Built for freelancers and small agencies who hate awkward money emails.</p></body></html>`;

  afterEach(() => ai.setDrafterForTests(undefined));

  it("keeps readable text only", () => {
    const text = ai.pageText(html);
    expect(text).toContain("polite reminders & follow-ups");
    expect(text).not.toContain("var a");
    expect(text).not.toContain(".x{}");
  });

  it("fits copy to the limit at a word boundary", () => {
    expect(ai.fit("short", 60)).toBe("short");
    const long = "Invoice reminders that go out on time, every time, for freelancers and agencies";
    const out = ai.fit(long, 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(long.startsWith(out)).toBe(true);
    expect(out).not.toMatch(/[ ,]$/);
  });

  it("uses drafted copy, trimmed to the field limits", async () => {
    ai.setDrafterForTests(async () => ({
      tagline: "Polite invoice reminders for freelancers.",
      shortDescription: "Acme follows up on late invoices for you. ".repeat(6),
      longDescription: "Acme connects to your invoicing tool and chases late payments. ".repeat(12),
    }));
    const out = await ai.withDraftedCopy(base, html);
    expect(out.drafted).toBe(true);
    expect(out.tagline).toBe("Polite invoice reminders for freelancers");
    expect(out.shortDescription!.length).toBeLessThanOrEqual(ai.LIMITS.short);
    expect(out.description!.length).toBeLessThanOrEqual(ai.LIMITS.long);
  });

  it("falls back to metadata without a key, on errors and on thin pages", async () => {
    ai.setDrafterForTests(null);
    expect(await ai.withDraftedCopy(base, html)).toBe(base);
    ai.setDrafterForTests(async () => {
      throw new Error("overloaded");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await ai.withDraftedCopy(base, html)).toBe(base);
    const called = vi.fn(async () => null);
    ai.setDrafterForTests(called);
    expect(await ai.withDraftedCopy(base, "<p>Hi</p>")).toBe(base);
    expect(called).not.toHaveBeenCalled();
  });
});
