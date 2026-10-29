import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { badgeSvg } from "@/lib/badges/svg";
import { ApplauseCount, ClapIcon } from "./clap-icon";

describe("clap icon", () => {
  it("is outlined until the viewer applauds, then filled", () => {
    const off = renderToStaticMarkup(createElement(ClapIcon));
    const on = renderToStaticMarkup(createElement(ClapIcon, { on: true }));
    expect(off).toContain("M160.22,24V8");
    expect(on).toContain("M188.87,65");
    expect(on).not.toContain("M217,97.58");
    expect(off).toContain('aria-hidden="true"');
  });

  it("labels a count as applause", () => {
    const out = renderToStaticMarkup(createElement(ApplauseCount, { count: 12 }));
    expect(out).toContain('aria-label="12 applause"');
    expect(out).toContain("12</span>");
  });

  it("draws the clap mark next to the badge's applause count", () => {
    const svg = badgeSvg({ kind: "featured", theme: "light", applause: 7 });
    expect(svg).toContain(">7<");
    expect(svg).toContain("clap-mark");
    expect(svg).not.toContain("M193 20.5");
  });
});
