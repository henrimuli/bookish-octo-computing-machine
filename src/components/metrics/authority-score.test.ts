import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthorityScore } from "./authority-score";

const html = (score: number | null) => renderToStaticMarkup(createElement(AuthorityScore, { score }));

describe("AuthorityScore", () => {
  it("shows the rounded score and fills the band to it", () => {
    const out = html(53.6);
    expect(out).toContain(">54<");
    expect(out).toContain('stroke-dashoffset="46"');
    expect(out).toContain('aria-label="Authority Score 54 out of 100"');
  });

  it("clamps to 0–100 and leaves the ring empty at 0 or unmeasured", () => {
    expect(html(140)).toContain('stroke-dashoffset="0"');
    expect(html(0)).not.toContain("score-band");
    const none = html(null);
    expect(none).toContain(">–<");
    expect(none).not.toContain("score-band");
  });
});
