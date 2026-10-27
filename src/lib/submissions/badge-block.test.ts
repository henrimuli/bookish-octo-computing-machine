import { describe, expect, it } from "vitest";
import { badgeBlockHtml } from "./badge-block";

describe("badge block", () => {
  it("wraps each directory's snippet in one block", () => {
    const html = badgeBlockHtml([
      { name: "Fazier", snippet: ' <a href="https://fazier.com"><img src="b.svg"></a> ' },
      { name: "Odd -- name", snippet: '<a href="https://odd.test">x</a>' },
    ]);
    expect(html).toContain('<a href="https://fazier.com"><img src="b.svg"></a>');
    expect(html).toContain("<!-- Odd - name -->");
    expect(html.startsWith("<!--")).toBe(true);
    expect(html.trim().endsWith("</div>")).toBe(true);
  });
});
