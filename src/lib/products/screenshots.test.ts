import { describe, expect, it } from "vitest";
import { imageType } from "./screenshots";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("imageType", () => {
  it("reads PNG, JPEG, GIF and WebP from their first bytes", () => {
    expect(imageType(bytes(0x89, 0x50, 0x4e, 0x47))?.ext).toBe("png");
    expect(imageType(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(imageType(bytes(0x47, 0x49, 0x46, 0x38))?.ext).toBe("gif");
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, ...new TextEncoder().encode("WEBP"), 0, 0]);
    expect(imageType(webp)).toEqual({ contentType: "image/webp", ext: "webp" });
  });

  it("rejects HTML, SVG and anything else served as an image", () => {
    expect(imageType(new TextEncoder().encode("<!doctype html><html>"))).toBeNull();
    expect(imageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
  });
});
