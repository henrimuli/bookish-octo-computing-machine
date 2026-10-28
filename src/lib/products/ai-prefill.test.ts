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

  describe("Gemini model fallback", () => {
    const input = { url: "https://acme.io/", name: "Acme", text: "Acme chases late invoices." };
    const copy = { tagline: "Polite invoice reminders", shortDescription: "Short.", longDescription: "Long." };
    const ok = (body: unknown) =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }));
    const modelOf = (url: string) => url.split("/models/")[1].split(":")[0];

    it("moves on from busy, out-of-quota and broken models", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const tried: string[] = [];
      const fake = vi.fn(async (url: string | URL | Request) => {
        const model = modelOf(String(url));
        tried.push(model);
        if (model === "m1") return new Response("quota", { status: 429 });
        if (model === "m2") return new Response("overloaded", { status: 503 });
        if (model === "m3") return ok({ tagline: 1 });
        if (model === "m4") throw new Error("timeout");
        return ok(copy);
      });
      const out = await ai.draftWithGemini(input, {
        apiKey: "k",
        models: ["m1", "m2", "m3", "m4", "m5", "m6"],
        fetch: fake as typeof fetch,
      });
      expect(out).toEqual(copy);
      expect(tried).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    });

    it("returns null when every model fails", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const fake = vi.fn(async () => new Response("quota", { status: 429 }));
      expect(await ai.draftWithGemini(input, { apiKey: "k", models: ["a", "b"], fetch: fake as typeof fetch })).toBe(
        null,
      );
      expect(fake).toHaveBeenCalledTimes(2);
    });

    it("stops at a rejected key instead of trying every model", async () => {
      const fake = vi.fn(async () => new Response("API key not valid", { status: 400 }));
      await expect(
        ai.draftWithGemini(input, { apiKey: "bad", models: ["a", "b"], fetch: fake as typeof fetch }),
      ).rejects.toThrow(/API key/);
      expect(fake).toHaveBeenCalledTimes(1);
    });

    it("tries the requested models in order, starting with gemini-3.8-flash", () => {
      expect(ai.GEMINI_MODELS[0]).toBe("gemini-3.8-flash");
      expect(ai.GEMINI_MODELS.at(-1)).toBe("gemini-3.1-flash-lite");
    });
  });
});
