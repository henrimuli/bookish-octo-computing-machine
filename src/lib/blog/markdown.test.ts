import { describe, expect, it } from "vitest";
import { escapeMarkdown, excerptFrom, renderMarkdown, safeHref } from "./markdown";

describe("renderMarkdown", () => {
  it("renders common markdown", () => {
    const html = renderMarkdown("## Hi\n\nSome **bold** and a [link](/p/x).");
    expect(html).toContain("<h2>Hi</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('<a href="/p/x">link</a>');
  });

  it("escapes raw HTML", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\nhi <img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops dangerous link and image URLs", () => {
    const html = renderMarkdown("[x](javascript:alert(1)) ![y](data:text/html,hi)");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:");
  });

  it("marks external links nofollow", () => {
    expect(renderMarkdown("[a](https://a.io)")).toContain('rel="noopener nofollow ugc"');
  });
});

describe("helpers", () => {
  it("allows only safe hrefs", () => {
    expect(safeHref("//evil.io")).toBeNull();
    expect(safeHref("JaVaScRiPt:x")).toBeNull();
    expect(safeHref("mailto:a@b.io")).toBe("mailto:a@b.io");
  });

  it("escapes maker text so it can't inject markdown", () => {
    const name = "[Click](javascript:x) **big** <b>";
    const html = renderMarkdown(`- ${escapeMarkdown(name)}`);
    expect(html).not.toContain("<a");
    expect(html).not.toContain("<strong>");
    expect(html).toContain("[Click](javascript:x) **big** &lt;b&gt;");
  });

  it("builds plain excerpts", () => {
    expect(excerptFrom("# Title\n\nHello [world](/x), this is **it**.")).toBe("Hello world, this is it.");
    expect(excerptFrom("a ".repeat(200), 20)).toHaveLength(20);
  });
});
